import { Response } from 'express';
import ListDTO from '../dtos/list.dto';
import BaseResponse from './base.response';

const StandardResponse = (baseResponse: BaseResponse, res: Response) => {
    if (baseResponse.hasErrors()) {
        res.json({ details: baseResponse.errorMessages[0] });
        return res;
    }

    if (Array.isArray(baseResponse.data)) 
        return res.status(200).json(new ListDTO(baseResponse.data));
    else 
        return res.status(200).json(baseResponse.data);
}

export default StandardResponse;