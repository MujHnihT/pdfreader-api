import BaseRequest from "../cores/base.request";
import BaseResponse from "../cores/base.response";

interface ICommonService {
    getAllNovel(request: BaseRequest): Promise<BaseResponse>;
    getAllChapter(request: BaseRequest): Promise<BaseResponse>;
}

export default ICommonService;
