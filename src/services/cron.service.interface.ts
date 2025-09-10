import BaseRequest from "../cores/base.request";
import BaseResponse from "../cores/base.response";

interface ICronService {
    fetchFromDrive(request: BaseRequest): Promise<BaseResponse>;
}

export default ICronService;
