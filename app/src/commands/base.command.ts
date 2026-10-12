abstract class BaseCommand {
  abstract execute(data: object): Promise<unknown>;
}

export default BaseCommand;
