abstract class BaseCommand {
  abstract execute(data: object): Promise<object | void>;
}

export default BaseCommand;
