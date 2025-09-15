import { IAppPkg, AppRunPriority } from 'app-life-cycle-pkg';
import { transportService, TransportAdapterName, CorrelatedMessage } from 'transport-pkg';
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

    this.setActionHandlers();
  }

  async shutdown(): Promise<void> {
    await appDataSource.destroy();
  }

  getPriority(): number {
    return AppRunPriority.Low;
  }

  private setActionHandlers() {
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
    transportService.setActionHandler(UserAction.CreateUser, async (req: CorrelatedMessage) => {
      return returns ? (await cmd.execute(req)) as object : {};
    });
  }
}

export default new App();
