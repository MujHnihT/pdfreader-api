import { STATUS_CODE_ENUM } from '../shared/constants.share';

class BaseResponse {
  public data: any;
  public errorMessages: string[];
  public status: number;

  constructor() {
    this.data = null;
    this.errorMessages = [];
    this.status = STATUS_CODE_ENUM.SUCCESS;
  }

  mergeData(data: any): this {
    this.data = data;
    return this;
  }

  hasErrors(): boolean {
    return this.errorMessages.length > 0;
  }

  addForbiddenException(message: string): this {
    this.status = STATUS_CODE_ENUM.FORBIDDEN;
    this.errorMessages.push(message);
    return this;
  }

  addUnauthorizedException(message: string): this {
    this.status = STATUS_CODE_ENUM.UNAUTHORIZED;
    this.errorMessages.push(message);
    return this;
  }

  addBadRequestException(message: string): this {
    this.status = STATUS_CODE_ENUM.BAD_REQUEST;
    this.errorMessages.push(message);
    return this;
  }

  addNotFoundException(message: string): this {
    this.status = STATUS_CODE_ENUM.NOT_FOUND;
    this.errorMessages.push(message);
    return this;
  }

  addConflictException(message: string): this {
    this.status = STATUS_CODE_ENUM.CONFLICT;
    this.errorMessages.push(message);
    return this;
  }

  addInternalServerException(message: string): this {
    this.status = STATUS_CODE_ENUM.INTERNAL_SERVER_ERROR;
    this.errorMessages.push(message);
    return this;
  }
}

export default BaseResponse;
