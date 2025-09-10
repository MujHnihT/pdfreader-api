import BaseRequest from "../../cores/base.request";
import BaseResponse from "../../cores/base.response";
import ICronService from "../cron.service.interface";
import { toSlug, listFolderInDrive } from "../../utility/common";

class CronService implements ICronService {

    async fetchFromDrive(request: BaseRequest): Promise<BaseResponse> {

        const data = await listFolderInDrive(    );


        throw new Error("Method not implemented.");
    }
   

   
}

export default CronService;