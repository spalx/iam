import { IAppPkg, AppRunPriority } from 'app-life-cycle-pkg';
import { transportService, TransportAdapterName, CorrelatedRequestDTO } from 'transport-pkg';
import { HTTPTransportAdapter } from 'http-transport-adapter';
import { AuthAction, UserAction, RoleAction } from 'iam-pkg';

import appDataSource from '@/config/db.config';
import appConfig from '@/config/app.config';
import BaseCommand from '@/commands/base.command';
import { GetJWKSCommand, AuthenticateCommand, CreateTokenCommand, RefreshTokenCommand, RevokeTokenCommand } from '@/commands/auth';
import { CreateUserCommand, UpdateUserCommand, GetUserCommand, GetUsersCommand, DeleteUserCommand } from '@/commands/user';
import { CreateRoleCommand, UpdateRoleCommand, GetRoleCommand, GetRolesCommand, DeleteRoleCommand } from '@/commands/role';

class App implements IAppPkg {
  async init(): Promise<void> {
    await appDataSource.initialize();

    transportService.registerTransport(TransportAdapterName.HTTP, new HTTPTransportAdapter(appConfig.app.port));

    this.registerTransportReceivables();
  }

  async shutdown(): Promise<void> {
    await appDataSource.destroy();
  }

  getPriority(): number {
    return AppRunPriority.Low;
  }

  private registerTransportReceivables() {
    this.registerTransportReceivable(AuthAction.GetJWKS, new GetJWKSCommand());
    this.registerTransportReceivable(AuthAction.Authenticate, new AuthenticateCommand());
    this.registerTransportReceivable(AuthAction.CreateToken, new CreateTokenCommand());
    this.registerTransportReceivable(AuthAction.RefreshToken, new RefreshTokenCommand());
    this.registerTransportReceivable(AuthAction.RevokeToken, new RevokeTokenCommand());

    this.registerTransportReceivable(UserAction.CreateUser, new CreateUserCommand());
    this.registerTransportReceivable(UserAction.UpdateUser, new UpdateUserCommand());
    this.registerTransportReceivable(UserAction.GetUser, new GetUserCommand());
    this.registerTransportReceivable(UserAction.GetUsers, new GetUsersCommand());
    this.registerTransportReceivable(UserAction.DeleteUser, new DeleteUserCommand());

    this.registerTransportReceivable(RoleAction.CreateRole, new CreateRoleCommand());
    this.registerTransportReceivable(RoleAction.UpdateRole, new UpdateRoleCommand());
    this.registerTransportReceivable(RoleAction.GetRole, new GetRoleCommand());
    this.registerTransportReceivable(RoleAction.GetRoles, new GetRolesCommand());
    this.registerTransportReceivable(RoleAction.DeleteRole, new DeleteRoleCommand());
  }

  private registerTransportReceivable(action: string, command: BaseCommand) {
    transportService.transportsReceive(action, async (data: CorrelatedRequestDTO) => {
      await command.execute(data);
    });
  }
}

export default new App();
