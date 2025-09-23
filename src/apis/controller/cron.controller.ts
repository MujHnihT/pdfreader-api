import { Request, Response } from 'express';
import StandardResponse from '../../cores/standardResponse';
import BaseRequest from '../../cores/base.request';
import ICronService from '../../services/cron.service.interface'

class CronController  {
    private cronService: ICronService;
    constructor(cronService: ICronService){
        this.cronService = cronService;
    }

    async fetch (req: Request, res: Response): Promise<Response> {
        const request = new BaseRequest(req);
        return StandardResponse(await this.cronService.fetchFromDrive(request), res);
    }
}

export default CronController;