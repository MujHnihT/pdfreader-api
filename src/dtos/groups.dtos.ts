
export class GroupDTOS {
    id: number;
    owner_id: number;
    group_name: string;
    model: string | undefined;
    invite_id: number;

    constructor(id: string, owner_id: string,group_name:string,invite_id: string) {
        this.id = Number(id);
        this.owner_id = Number(owner_id);
        this.group_name = group_name;
        this.invite_id = Number(invite_id);
    }
}
