import { BaseRepository } from "../cores/base.repository";
import { IBaseRepository } from "../cores/base.repository.interface";
import Chapter, { IChapter } from "../model/chapters.model";

export class ChapterRepository extends BaseRepository<IChapter> implements IBaseRepository<IChapter> {
    constructor() {
        super(Chapter);
    }
}