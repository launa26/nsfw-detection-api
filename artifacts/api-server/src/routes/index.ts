import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nsfwRouter from "./nsfw";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nsfwRouter);

export default router;
