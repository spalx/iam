import { IAppPkg, AppRunPriority } from 'app-life-cycle-pkg';
import { transportService, TransportAdapterName, CorrelatedMessage } from 'transport-pkg';
import { HTTPTransportAdapter } from 'http-transport-adapter';
import { AuthAction, UserAction, RoleAction, SERVICE_NAME } from 'iam-pkg';
import { serviceDiscoveryService } from 'service-discovery-pkg';

import appDataSource from '@/config/db.config';
import appConfig from '@/config/app.config';
import BaseCommand from '@/commands/base.command';
import { GetJWKSCommand, AuthenticateCommand, CreateTokenCommand, RefreshTokenCommand, RevokeTokenCommand } from '@/commands/auth';
import { CreateUserCommand, UpdateUserCommand, GetUserCommand, GetUsersCommand, DeleteUserCommand } from '@/commands/user';
import { CreateRoleCommand, UpdateRoleCommand, GetRoleCommand, GetRolesCommand, DeleteRoleCommand } from '@/commands/role';

class App implements IAppPkg {
  private httpTransportAdapter: HTTPTransportAdapter;

  constructor() {
    this.httpTransportAdapter = new HTTPTransportAdapter(appConfig.app.port);

    transportService.registerTransport(TransportAdapterName.HTTP, this.httpTransportAdapter);

    this.setActionHandlers();
  }

  async init(): Promise<void> {
    await appDataSource.initialize();

    // Make service discoverable by other services
    await serviceDiscoveryService.registerService({
      service_name: SERVICE_NAME,
      host: appConfig.app.host,
      port: appConfig.app.port,
    });
  }

  async shutdown(): Promise<void> {
    await serviceDiscoveryService.deregisterService(appConfig.app.host);
    await appDataSource.destroy();
  }

  getPriority(): number {
    return AppRunPriority.High;
  }

  getName(): string {
    return SERVICE_NAME;
  }

  getDependencies(): IAppPkg[] {
    return [
      transportService,
      this.httpTransportAdapter,
      serviceDiscoveryService
    ];
  }

  private setActionHandlers(): void {
    // Auth action handlers
    this.setActionHandler(AuthAction.GetJWKS, new GetJWKSCommand());
    this.setActionHandler(AuthAction.Authenticate, new AuthenticateCommand());
    this.setActionHandler(AuthAction.CreateToken, new CreateTokenCommand());
    this.setActionHandler(AuthAction.RefreshToken, new RefreshTokenCommand());
    this.setActionHandler(AuthAction.RevokeToken, new RevokeTokenCommand(), false);

    // User action handlers
    this.setActionHandler(UserAction.CreateUser, new CreateUserCommand());
    this.setActionHandler(UserAction.UpdateUser, new UpdateUserCommand());
    this.setActionHandler(UserAction.GetUser, new GetUserCommand());
    this.setActionHandler(UserAction.GetUsers, new GetUsersCommand());
    this.setActionHandler(UserAction.DeleteUser, new DeleteUserCommand(), false);

    // Role action handlers
    this.setActionHandler(RoleAction.CreateRole, new CreateRoleCommand());
    this.setActionHandler(RoleAction.UpdateRole, new UpdateRoleCommand());
    this.setActionHandler(RoleAction.GetRole, new GetRoleCommand());
    this.setActionHandler(RoleAction.GetRoles, new GetRolesCommand());
    this.setActionHandler(RoleAction.DeleteRole, new DeleteRoleCommand(), false);
  }

  private setActionHandler(action: string, cmd: BaseCommand, returns = true): void {
    transportService.setActionHandler(action, async (req: CorrelatedMessage) => {
      const res = await cmd.execute(req);
      return returns ? res as object : {};
    });
  }
}

export default new App();
