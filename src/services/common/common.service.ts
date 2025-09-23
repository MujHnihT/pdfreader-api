import BaseRequest from "../../cores/base.request";
import BaseResponse from "../../cores/base.response";
import { NovelRepository } from "../../repo/novel.repository";
import { ChapterRepository } from "../../repo/chapter.repository";
import ICommonService from "../common.service.interface";
class CommonService implements ICommonService {
    private novelRepository: NovelRepository;
    private chapterRepository: ChapterRepository;
    constructor() {
        this.novelRepository = new NovelRepository();
        this.chapterRepository = new ChapterRepository();
    }
    async getAllNovel(request: BaseRequest): Promise<BaseResponse> {
        const response = new BaseResponse();
        try {
            let allChapter = await this.novelRepository.findAll({}, []);
            response.mergeData(allChapter);
            return response;
        } catch (error) {
            response.addInternalServerException("Exception: " + error);
            return response;
        }
    }
    async getAllChapter(request: BaseRequest): Promise<BaseResponse> {
        const response = new BaseResponse();
        try {
            const novelId = request.params.id;
            let allChapter = await this.chapterRepository.findAll({ novelId: novelId }, []);

            response.mergeData(allChapter);
            return response;
        } catch (error) {
            response.addInternalServerException("Exception: " + error);
            return response;
        }
    }


}

export default CommonService;