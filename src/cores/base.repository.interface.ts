import { Model, ClientSession } from "mongoose";

export interface IBaseRepository<T> {
    create(data: T): Promise<T>;
    createMany(data: T[], opts?: { ordered?: boolean; session?: ClientSession }): Promise<T[]>;

    findAll(condition: object, populateFields: string | string[], sortOptions?: Record<string, 1 | -1>): Promise<T[]>;
    findById(id: string, populateFields: string | string[]): Promise<T | null>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    deleteAll(): Promise<boolean>;
    deleteRange(ids: string[]): Promise<boolean>;
    findOne(condition: object): Promise<T | null>;
    find(condition: object): Promise<T[]>;
    findPagination(condition: object, limit?: number, offset?: number): Promise<{ data: T[]; total: number }>;
    aggregate(pipeline: object[]): Promise<any[]>;
    count(condition: object): Promise<number>;
}
