import http from 'http';
import { AppRunPriority, IAppPkg } from '@spalx/app-life-cycle-pkg';
import { HTTPTransportAdapter } from '@spalx/http-transport-adapter';
import { AuthAction, RoleAction, UserAction } from '@spalx/iam-pkg';
import { serviceDiscoveryService } from '@spalx/service-discovery-pkg';
import { CorrelatedMessage, TransportAdapterName, transportService } from '@spalx/transport-pkg';

import appDataSource from '@/common/db/app-data-source';
import BaseCommand from '@/commands/base.command';
import {
  AuthenticateCommand,
  CreateTokenCommand,
  GetJWKSCommand,
  RefreshTokenCommand,
  RevokeTokenCommand,
} from '@/commands/auth';
import {
  CreateRoleCommand,
  DeleteRoleCommand,
  DeleteRolesCommand,
  GetRoleCommand,
  GetRolesCommand,
  UpdateRoleCommand,
} from '@/commands/role';
import {
  CreateUserCommand,
  DeleteUserCommand,
  GetUserCommand,
  GetUsersCommand,
  UpdateUserCommand,
} from '@/commands/user';

jest.mock('@/common/db/app-data-source', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), runMigrations: jest.fn(), destroy: jest.fn() },
}));

type ActionHandler = (req: CorrelatedMessage) => Promise<object>;
interface CommandClass {
  prototype: BaseCommand;
}

// Each action, the command that handles it, and whether the command's result is the answer.
const ACTIONS: [string, CommandClass, boolean][] = [
  [AuthAction.GetJWKS, GetJWKSCommand, true],
  [AuthAction.Authenticate, AuthenticateCommand, true],
  [AuthAction.CreateToken, CreateTokenCommand, true],
  [AuthAction.RefreshToken, RefreshTokenCommand, true],
  [AuthAction.RevokeToken, RevokeTokenCommand, false],
  [UserAction.CreateUser, CreateUserCommand, true],
  [UserAction.UpdateUser, UpdateUserCommand, true],
  [UserAction.GetUser, GetUserCommand, true],
  [UserAction.GetUsers, GetUsersCommand, true],
  [UserAction.DeleteUser, DeleteUserCommand, false],
  [RoleAction.CreateRole, CreateRoleCommand, true],
  [RoleAction.UpdateRole, UpdateRoleCommand, true],
  [RoleAction.GetRole, GetRoleCommand, true],
  [RoleAction.GetRoles, GetRolesCommand, true],
  [RoleAction.DeleteRole, DeleteRoleCommand, false],
  [RoleAction.DeleteRoles, DeleteRolesCommand, false],
];

function buildRequest(action: string, data: object): CorrelatedMessage {
  return CorrelatedMessage.create('c0ffee00-0000-4000-8000-000000000001', action, TransportAdapterName.HTTP, data);
}

function actionHandler(action: string): ActionHandler {
  const handler = transportService.getActionHandlers()[action];
  if (!handler) {
    throw new Error(`No handler registered for ${action}`);
  }
  return handler as ActionHandler;
}

// The position of the mock's only call; fails if it wasn't called exactly once.
function firstCall(mock: unknown): number {
  const calls = jest.mocked(mock as jest.Mock).mock.invocationCallOrder;
  expect(calls).toHaveLength(1);
  return calls[0];
}

describe('App', () => {
  // Copied out in beforeAll, because clearMocks empties the spies' calls before each test.
  let registeredTransports: unknown[][];
  let listenCallCount: number;
  let app: IAppPkg;

  beforeAll(async () => {
    const registerTransport = jest.spyOn(transportService, 'registerTransport');
    const listen = jest.spyOn(http.Server.prototype, 'listen');

    app = (await import('./app')).default;

    registeredTransports = [...registerTransport.mock.calls];
    listenCallCount = listen.mock.calls.length;
  });

  beforeEach(() => {
    jest.spyOn(serviceDiscoveryService, 'registerService').mockResolvedValue(undefined);
    jest.spyOn(serviceDiscoveryService, 'deregisterService').mockResolvedValue(undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('App - constructor', () => {
    it('should register an HTTP transport and list it as a dependency', () => {
      expect(registeredTransports.map(([name]) => name)).toEqual([TransportAdapterName.HTTP]);
      const [[, httpAdapter]] = registeredTransports;
      expect(httpAdapter).toBeInstanceOf(HTTPTransportAdapter);
      expect(app.getDependencies?.()).toEqual([transportService, httpAdapter, serviceDiscoveryService]);
    });

    it('should handle the 16 auth, user and role actions', () => {
      expect(Object.keys(transportService.getActionHandlers()).sort()).toEqual(
        ACTIONS.map(([action]) => action).sort()
      );
    });

    it('should not start the HTTP server', () => {
      expect(listenCallCount).toBe(0);
    });
  });

  describe('App - action handlers', () => {
    it.each(ACTIONS.filter(([, , returns]) => returns))(
      'should answer %s with its command result',
      async (action, Command) => {
        // Arrange
        const req = buildRequest(action, { id: 'user-1' });
        const execute = jest.spyOn(Command.prototype, 'execute').mockResolvedValueOnce({ answer: action });

        // Act
        const result = await actionHandler(action)(req);

        // Assert
        expect(result).toEqual({ answer: action });
        expect(execute.mock.calls).toEqual([[req]]);
      }
    );

    it.each(ACTIONS.filter(([, , returns]) => !returns))(
      'should run %s and answer with an empty object',
      async (action, Command) => {
        const req = buildRequest(action, { id: 'user-1' });
        const execute = jest.spyOn(Command.prototype, 'execute').mockResolvedValueOnce({ ignored: true });

        const result = await actionHandler(action)(req);

        expect(result).toEqual({});
        expect(execute.mock.calls).toEqual([[req]]);
      }
    );

    it('should pass a command error through', async () => {
      const error = new Error('Invalid credentials');
      jest.spyOn(CreateTokenCommand.prototype, 'execute').mockRejectedValueOnce(error);

      await expect(actionHandler(AuthAction.CreateToken)(buildRequest(AuthAction.CreateToken, {}))).rejects.toBe(error);
    });
  });

  describe('App - init', () => {
    it('should connect, migrate, then register the service', async () => {
      // Act
      await app.init?.();

      // Assert
      expect(serviceDiscoveryService.registerService).toHaveBeenCalledWith({
        service_name: 'iam',
        host: 'iam',
        port: 3030,
      });
      const order = [
        firstCall(appDataSource.initialize),
        firstCall(appDataSource.runMigrations),
        firstCall(serviceDiscoveryService.registerService),
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('should not register when a migration fails', async () => {
      const error = new Error('function uuid_generate_v4() does not exist');
      jest.mocked(appDataSource.runMigrations).mockRejectedValueOnce(error);

      await expect(app.init?.()).rejects.toBe(error);
      expect(serviceDiscoveryService.registerService).not.toHaveBeenCalled();
    });
  });

  describe('App - shutdown', () => {
    it('should deregister under the configured host, then disconnect', async () => {
      // Act
      await app.shutdown?.();

      // Assert
      expect(serviceDiscoveryService.deregisterService).toHaveBeenCalledWith('iam');
      const order = [firstCall(serviceDiscoveryService.deregisterService), firstCall(appDataSource.destroy)];
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });
  });

  describe('App - identity', () => {
    it('should be named iam', () => {
      expect(app.getName()).toBe('iam');
    });

    it('should run with high priority', () => {
      expect(app.getPriority?.()).toBe(AppRunPriority.High);
    });
  });
});
