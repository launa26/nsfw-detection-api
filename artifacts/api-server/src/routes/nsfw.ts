import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import axios from "axios";
import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import { Jimp } from "jimp";

type NsfwjsPrediction = { className: string; probability: number };

const router: IRouter = Router();

let model: nsfwjs.NSFWJS | null = null;
let modelLoading = false;
let modelError: string | null = null;

async function getModel(): Promise<nsfwjs.NSFWJS> {
  if (model) return model;
  if (modelLoading) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!modelLoading) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    if (model) return model;
    throw new Error(modelError ?? "Model failed to load");
  }
  modelLoading = true;
  try {
    model = await nsfwjs.load();
    modelLoading = false;
    return model;
  } catch (err) {
    modelLoading = false;
    modelError = err instanceof Error ? err.message : "Unknown error loading model";
    throw err;
  }
}

const NSFW_CATEGORIES = ["Porn", "Hentai", "Sexy"];

function buildResult(predictions: NsfwjsPrediction[], threshold: number) {
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const topCategory = sorted[0];

  const nsfwScore = predictions
    .filter((p) => NSFW_CATEGORIES.includes(p.className))
    .reduce((acc, p) => acc + p.probability, 0);

  const isNsfw =
    NSFW_CATEGORIES.includes(topCategory.className) && nsfwScore >= threshold;

  return {
    isNsfw,
    score: parseFloat(nsfwScore.toFixed(4)),
    category: topCategory.className,
    predictions: predictions.map((p) => ({
      className: p.className,
      probability: parseFloat(p.probability.toFixed(4)),
    })),
    threshold,
  };
}

async function bufferToTensor(buffer: Buffer): Promise<tf.Tensor3D> {
  const image = await Jimp.read(buffer);
  const { width, height } = image.bitmap;
  const pixels = new Uint8Array(width * height * 3);
  let idx = 0;
  const data = image.bitmap.data;
  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * 4;
    pixels[idx++] = data[srcIdx];
    pixels[idx++] = data[srcIdx + 1];
    pixels[idx++] = data[srcIdx + 2];
  }
  const tensor = tf.tensor3d(pixels, [height, width, 3], "int32");
  return tensor as unknown as tf.Tensor3D;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post("/nsfw/check-url", async (req: Request, res: Response) => {
  const { url, threshold = 0.6 } = req.body as {
    url?: string;
    threshold?: number;
  };

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "BAD_REQUEST", message: "url is required" });
    return;
  }

  const thresholdNum =
    typeof threshold === "number" ? threshold : parseFloat(String(threshold));
  if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 1) {
    res
      .status(400)
      .json({
        error: "BAD_REQUEST",
        message: "threshold must be between 0 and 1",
      });
    return;
  }

  let tensor: tf.Tensor3D | null = null;
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxContentLength: 20 * 1024 * 1024,
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);
    tensor = await bufferToTensor(buffer);
    const nsfwModel = await getModel();
    const predictions = await nsfwModel.classify(tensor);
    const result = buildResult(predictions, thresholdNum);

    res.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process image";
    req.log.error({ err, url }, "NSFW URL check failed");
    res.status(500).json({ error: "PROCESSING_ERROR", message });
  } finally {
    tensor?.dispose();
  }
});

router.post(
  "/nsfw/check-file",
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res
        .status(400)
        .json({ error: "BAD_REQUEST", message: "image file is required" });
      return;
    }

    const { threshold = 0.6 } = req.body as { threshold?: string | number };
    const thresholdNum =
      typeof threshold === "number"
        ? threshold
        : parseFloat(String(threshold));
    if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 1) {
      res
        .status(400)
        .json({
          error: "BAD_REQUEST",
          message: "threshold must be between 0 and 1",
        });
      return;
    }

    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = await bufferToTensor(req.file.buffer);
      const nsfwModel = await getModel();
      const predictions = await nsfwModel.classify(tensor);
      const result = buildResult(predictions, thresholdNum);

      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to process image";
      req.log.error({ err }, "NSFW file check failed");
      res.status(500).json({ error: "PROCESSING_ERROR", message });
    } finally {
      tensor?.dispose();
    }
  }
);

export default router;
