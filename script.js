import OpenAI from "openai";
import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import dotenv from "dotenv";
import { exec } from "child_process";
import util from "util";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Check if ffprobe exists
if (!fs.existsSync(ffprobeStatic.path)) {
    console.error("FFprobe binary not found!");
    process.exit(1);
}

// Example: Get audio duration
ffmpeg.ffprobe("audio.mp3", (err, metadata) => {
    if (err) {
        console.error("Error getting audio duration:", err);
    } else {
        console.log("Audio duration:", metadata.format.duration, "seconds");
    }
});

dotenv.config();  // Load .env file for API keys
const execPromise = util.promisify(exec);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Step 1: Generate Transcript using GPT-4
async function generateTranscript(userMessage) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You generate concise summaries for the given prompt." },
                { role: "user", content: userMessage }
            ],
            max_tokens: 250
        });

        const transcript = response.choices[0].message.content;
        fs.writeFileSync("transcript.txt", transcript);
        console.log("Transcript generated:", transcript);
        return transcript;
    } catch (error) {
        console.error("Error generating transcript:", error.message);
        return null;
    }
}

// Step 2: Convert Text to Speech
async function textToSpeech(text) {
    try {
        const response = await openai.audio.speech.create({
            model: "tts-1",
            input: text,
            voice: "alloy",
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync("audio.mp3", buffer);
        return "audio.mp3";
    } catch (error) {
        console.error("Error in TTS:", error.message);
        return null;
    }
}

// Step 3: Generate Safe Image Prompts
async function generateImagePrompts(transcript) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You generate safe image descriptions using the Transcript" },
                { role: "user", content: `Extract 5 visual descriptions for images from the following transcript:\n${transcript}` }
            ],
            max_tokens: 200
        });

        return response.choices[0].message.content.split("\n").filter(Boolean);
    } catch (error) {
        console.error("Error generating image prompts:", error.message);
        return [];
    }
}

// Step 4: Generate Images using DALL·E
async function generateImages(prompts) {
    let imageFiles = [];
    for (let i = 0; i < prompts.length; i++) {
        try {
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: prompts[i],
                size: "1024x1024",
                n: 1,
            });

            const imageUrl = response.data[0].url;
            const imagePath = `image_${i + 1}.png`;

            const responseImage = await axios({
                url: imageUrl,
                responseType: "arraybuffer",
            });
            fs.writeFileSync(imagePath, responseImage.data);
            imageFiles.push(imagePath);
        } catch (error) {
            console.error(`Error generating image ${i + 1}:`, error.message);
        }
    }
    return imageFiles;
}

async function getAudioDuration(audioFile) {
    try {
        const ffprobePath = ffprobeStatic.path;
        const { stdout } = await execPromise(
            `"${ffprobePath}" -i "${audioFile}" -show_entries format=duration -v quiet -of csv=p=0`
        );

        return parseFloat(stdout.trim());
    } catch (error) {
        console.error("Error getting audio duration:", error.message);
        return null;
    }
}

async function createImageSequenceVideo(imageFiles, audioDuration, tempVideoFile = "temp_video.mp4") {
    try {
        const imageDuration = audioDuration / imageFiles.length;
        const absolutePaths = imageFiles.map((img) => path.resolve(img));
        const fileListPath = path.resolve("file_list.txt");
        const fileListContent = absolutePaths
            .map((img) => `file '${img.replace(/\\/g, "/")}'\nduration ${imageDuration}`)
            .join("\n");

        fs.writeFileSync(fileListPath, fileListContent);
        
        await execPromise(
            `"${ffmpegStatic}" -f concat -safe 0 -i "${fileListPath}" -vsync vfr -pix_fmt yuv420p "${tempVideoFile}"`
        );

        return tempVideoFile;
    } catch (error) {
        console.error("Error creating image sequence video:", error.message);
        return null;
    }
}

async function createVideo(imageFiles, audioFile, outputFile = "output_video.mp4") {
    const audioDuration = await getAudioDuration(audioFile);
    if (!audioDuration) throw new Error("Failed to retrieve audio duration");

    const tempVideoFile = await createImageSequenceVideo(imageFiles, audioDuration);
    if (!tempVideoFile) throw new Error("Failed to generate image sequence video");

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(tempVideoFile)
            .input(audioFile)
            .outputOptions([
                "-c:v libx264",
                "-r 30",
                "-pix_fmt yuv420p",
                "-c:a aac",
                "-b:a 192k",
                `-t ${audioDuration}`
            ])
            .output(outputFile)
            .on("end", () => resolve(outputFile))
            .on("error", (err) => reject(err))
            .run();
    });
}

async function main() {
    try {
        const userPrompt = process.env.USER_PROMPT; // Get prompt from environment variable

        if (!userPrompt) {
            return res.status(400).json({ error: "USER_PROMPT is not set in environment variables." });
        }
        const transcript = await generateTranscript(userPrompt);
        if (!transcript) throw new Error("Failed to generate transcript");

        const audioFile = await textToSpeech(transcript);
        if (!audioFile) throw new Error("Failed to generate audio");

        const imagePrompts = await generateImagePrompts(transcript);
        const imageFiles = await generateImages(imagePrompts);
        if (imageFiles.length === 0) throw new Error("No images generated");

        const videoFile = await createVideo(imageFiles, audioFile);
        console.log(`Final video created: ${videoFile}`);
    } catch (error) {
        console.error("Workflow failed:", error.message);
    }
}

main();
