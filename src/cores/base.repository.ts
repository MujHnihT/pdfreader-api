import { IBaseRepository } from './base.repository.interface';
import { Model, HydratedDocument, FilterQuery, PipelineStage, ClientSession } from 'mongoose';

export class BaseRepository<T> implements IBaseRepository<HydratedDocument<T>> {
    constructor(private model: Model<T>) { }

    async create(data: T): Promise<HydratedDocument<T>> {
        return this.model.create(data);
    }
    async createMany(data: T[], opts?: { ordered?: boolean; session?: ClientSession }) {
        return (await this.model.insertMany(data as any[], { ordered: opts?.ordered ?? true, session: opts?.session })) as any;
    }
    async findAll(condition: FilterQuery<T>, populateFields: string | string[], sortOptions?: Record<string, 1 | -1>): Promise<HydratedDocument<T>[]> {
        let query = this.model.find(condition);

        if (populateFields)
            query = query.populate(populateFields);

        if (sortOptions)
            query = query.sort(sortOptions);

        return query.exec();
    }

    async findById(id: string, populateFields: string | string[]): Promise<HydratedDocument<T> | null> {
        let query = this.model.findById(id);

        if (populateFields) {
            query = query.populate(populateFields);
        }

        return query.exec();
    }

    async update(id: string, data: Partial<T>): Promise<HydratedDocument<T> | null> {
        return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.model.deleteOne({ _id: id }).exec();
        return result.deletedCount > 0;
    }

    async deleteRange(ids: string[]): Promise<boolean> {
        const result = await this.model.deleteMany({ _id: { $in: ids } }).exec();
        return result.deletedCount > 0;
    }

    async deleteAll(): Promise<boolean> {
        const result = await this.model.deleteMany({}).exec();
        return result.deletedCount > 0;
    }


    async findOne(condition: FilterQuery<T>): Promise<HydratedDocument<T> | null> {
        return this.model.findOne(condition).exec();
    }

    async find(condition: FilterQuery<T>): Promise<HydratedDocument<T>[]> {
        return this.model.find(condition).exec();
    }

    async findPagination(condition: FilterQuery<T>, limit: number = 10, offset: number = 0): Promise<{ data: HydratedDocument<T>[]; total: number }> {
        const total = await this.model.countDocuments(condition).exec();
        const data = await this.model.find(condition).skip(offset).limit(limit).exec();
        return { data, total };
    }

    async aggregate(pipeline: PipelineStage[]): Promise<any[]> {
        return this.model.aggregate(pipeline).exec();
    }

    async count(condition: FilterQuery<T>): Promise<number> {
        return this.model.countDocuments(condition).exec();
    }
    async updateAll(condition: FilterQuery<T>, data: Partial<T>): Promise<number> {
        const result = await this.model.updateMany(condition, data).exec();
        return result.modifiedCount;
    }

}
