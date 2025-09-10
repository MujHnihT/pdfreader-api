import BaseRequest from "../../cores/base.request";

class getAllChapterParams {
    public novelId: string;

    constructor(req: BaseRequest) {
        this.novelId = req.body.novelId;
    }
}
export {  getAllChapterParams};