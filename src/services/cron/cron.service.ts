import BaseRequest from "../../cores/base.request";
import BaseResponse from "../../cores/base.response";
import ICronService from "../cron.service.interface";
import { listFolderInDrive } from "../../utility/common";
import DriveResponse from "./cron.model";
import Novel from "../../model/novels.model";
import Chapter from "../../model/chapters.model";
import { NovelRepository } from "../../repo/novel.repository";
import { ChapterRepository } from "../../repo/chapter.repository";
const ROOT_FOLDER_ID = process.env.DRIVE_FOLDER_ID || "";
class CronService implements ICronService {
    private novelRepository: NovelRepository;
    private chapterRepository: ChapterRepository;
    constructor() {
        this.novelRepository = new NovelRepository();
        this.chapterRepository = new ChapterRepository();
    }
    async fetchFromDrive(request: BaseRequest): Promise<BaseResponse> {
        const response = new BaseResponse();
        try {
            await this.novelRepository.deleteAll();
            await this.chapterRepository.deleteAll();
            const data: DriveResponse = await listFolderInDrive(ROOT_FOLDER_ID, false);
            let novels = [];
            let chapters = [];
            for (const file of data.files) {
                let novel = new Novel();
                novel.novelName = file.name;
                novel.novelCode = file.id;
                novels.push(novel);
            }

            const novelRes = await this.novelRepository.createMany(novels, { ordered: false });
            for (const novel of novelRes) {
                const data: DriveResponse = await listFolderInDrive(novel.novelCode,true);
                for (const file of data.files) {
                    let chapter = new Chapter();
                    chapter.chapterName = file.name;
                    chapter.chapterCode = file.id;
                    chapter.novelId = novel._id;
                    chapters.push(chapter);
                }
            }
            const chapterRes = await this.chapterRepository.createMany(chapters, { ordered: false });
            response.mergeData({ novels: novelRes, chapters: chapterRes });
            return response;
        } catch (error) {
            response.addInternalServerException("Exception: " + error);
            return response;
        }
    }



}

export default CronService;