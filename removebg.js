import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import path from "node:path";

const TOKEN_PATH = path.resolve(process.cwd(), "tokens.json");

function getApiKey() {
    try {
        const t = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        return t?.removebg?.apiKey || null;
    } catch { return null; }
}

export async function removeBackground(inputBuffer) {
    const apiKey = getApiKey();

    const form = new FormData();
    form.append("image_file", inputBuffer, { filename: "image.png", contentType: "image/png" });
    form.append("size", "auto");

    const headers = {
        ...form.getHeaders(),
    };

    if (apiKey) {
        headers["X-Api-Key"] = apiKey;
    } else {
        throw new Error(
            "Chưa cấu hình removebg.apiKey trong tokens.json!\n" +
            "→ Lấy API key miễn phí tại: https://www.remove.bg/api\n" +
            "→ Thêm vào tokens.json: \"removebg\": { \"apiKey\": \"your-key\" }"
        );
    }

    let response;
    try {
        response = await axios.post(
            "https://api.remove.bg/v1.0/removebg",
            form,
            {
                headers,
                responseType: "arraybuffer",
                timeout: 60000,
            }
        );
    } catch (e) {
        const status = e?.response?.status;
        const body = e?.response?.data
            ? Buffer.from(e.response.data).toString("utf8").slice(0, 300)
            : "";
        if (status === 402) throw new Error("Remove.bg hết credit! Mua thêm tại remove.bg");
        if (status === 403) throw new Error("Remove.bg: API key không hợp lệ hoặc hết hạn!");
        if (status === 429) throw new Error("Remove.bg: gửi quá nhiều, thử lại sau nhé!");
        throw new Error(`Remove.bg lỗi HTTP ${status || e?.code || e?.message}${body ? `: ${body}` : ""}`);
    }

    if (response.status === 200 && response.data?.byteLength > 500) {
        return Buffer.from(response.data);
    }
    throw new Error(`Remove.bg trả về status ${response.status}`);
}

export async function scanWebProviders() {
    const apiKey = getApiKey();
    return [
        {
            provider: "Remove.bg",
            status: apiKey ? "ok" : "no_key",
            credits: apiKey
                ? "Production mode (có API key)"
                : "Chưa cấu hình apiKey",
        },
    ];
}
