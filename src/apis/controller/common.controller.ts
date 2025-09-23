import { Request, Response } from 'express';
import StandardResponse from '../../cores/standardResponse';
import BaseRequest from '../../cores/base.request';
import ICommonService from '../../services/common.service.interface'

class CommonController  {
    private commonService: ICommonService;
    constructor(commonService: ICommonService){
        this.commonService = commonService;
    }

    async getAllChapter (req: Request, res: Response): Promise<Response> {
        const request = new BaseRequest(req);
        return StandardResponse(await this.commonService.getAllChapter(request), res);
    }
    async getAllNovel(req: Request, res: Response): Promise<Response> {
        const request = new BaseRequest(req);
        return StandardResponse(await this.commonService.getAllNovel(request), res);
    }
}

export default CommonController;