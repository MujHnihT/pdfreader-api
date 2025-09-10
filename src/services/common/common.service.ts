import BaseRequest from "../../cores/base.request";
import BaseResponse from "../../cores/base.response";
import { SysUserRepository } from "../../repo/sys-user.repository";
import ICommonService from "../common.service.interface";

class AuthService implements ICommonService {
    private sysUserRepository: SysUserRepository;
    constructor() {
        this.sysUserRepository = new SysUserRepository();
    }
    getAllNovel(request: BaseRequest): Promise<BaseResponse> {
        throw new Error("Method not implemented.");
    }
    getAllChapter(request: BaseRequest): Promise<BaseResponse> {
        throw new Error("Method not implemented.");
    }

   
}

export default AuthService;