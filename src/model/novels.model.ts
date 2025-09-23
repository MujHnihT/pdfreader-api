import mongoose, { Schema } from 'mongoose';

export interface INovel {
    novelName: string;
    novelCode: string;
    created_at: Date;
    updated_at: Date;
}

const NovelSchema = new Schema<INovel>({
    novelName: {
        type: String,
        required: true
    },
    novelCode: {
        type: String,
        required: true,
        unique: true
    }}, 
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
        versionKey: false
});

NovelSchema.virtual('created_at').get(function (this: any) {
    return this.createdAt;
});

NovelSchema.virtual('updated_at').get(function (this: any) {
    return this.updatedAt;
});

const Novel = mongoose.model<INovel>('novels', NovelSchema);

export default Novel;



