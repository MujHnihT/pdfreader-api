class ListDTO {
    public data: any[];
    public total: number;

    constructor(list: any[]) {
        this.data = list;
        this.total = list.length;
    }
}

export default ListDTO;
