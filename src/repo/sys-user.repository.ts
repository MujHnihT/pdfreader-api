import { BaseRepository } from "../cores/base.repository";
import { IBaseRepository } from "../cores/base.repository.interface";
import SysUser, { ISysUser } from "../model/sys-user.model";

export class SysUserRepository extends BaseRepository<ISysUser> implements IBaseRepository<ISysUser> {
    constructor() {
        super(SysUser);
    }
}