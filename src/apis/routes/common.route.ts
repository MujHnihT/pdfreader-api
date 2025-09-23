import express from 'express';
import CommonController from '../controller/common.controller';
import CommonService from '../../services/common/common.service';
const router = express.Router();

const commonController = new CommonController(new CommonService());

router.get('/getNovels', (req, res) => commonController.getAllNovel(req, res));
router.get('/:id/getChapters', (req, res) => commonController.getAllChapter(req, res));

export default router;
