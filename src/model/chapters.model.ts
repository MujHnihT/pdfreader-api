import mongoose, { Schema } from 'mongoose';

export interface IChapter {
    novelId: Schema.Types.ObjectId;
    chapterName: string;
    chapterCode: string;
    created_at: Date;
    updated_at: Date;
}

const ChapterSchema = new Schema<IChapter>({
    novelId: {
        type: Schema.Types.ObjectId,
        ref: 'novels',
        required: true
    }, chapterName: {
        type: String,
        required: true,
    },
    chapterCode: {
        type: String,
        required: true,
    }
},
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
        versionKey: false
    });

ChapterSchema.virtual('created_at').get(function (this: any) {
    return this.createdAt;
});

ChapterSchema.virtual('updated_at').get(function (this: any) {
    return this.updatedAt;
});

const Chapter = mongoose.model<IChapter>('chapters', ChapterSchema);

export default Chapter;



