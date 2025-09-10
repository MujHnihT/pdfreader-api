import { BaseRepository } from "../cores/base.repository";
import { IBaseRepository } from "../cores/base.repository.interface";
import Novel, { INovel } from "../model/novels.model";

export class SysUserRepository extends BaseRepository<INovel> implements IBaseRepository<INovel> {
    constructor() {
        super(Novel);
    }
}