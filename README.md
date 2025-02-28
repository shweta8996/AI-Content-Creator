# AI Video Generator

## Overview
The **AI Video Generator** is a tool that automates the process of generating a video from a given text prompt. It utilizes OpenAI's GPT and TTS capabilities to create a transcript, convert it to speech, generate images using DALL·E, and finally compile everything into a video.

## Features
- **Transcript Generation**: Converts input text into a concise transcript.
- **Text-to-Speech (TTS)**: Uses OpenAI's TTS model to generate an audio file from the transcript.
- **Image Generation**: Extracts visual descriptions from the transcript and generates images using DALL·E.
- **Video Compilation**: Combines the generated images and audio into a final video output.

## Installation & Setup
### Prerequisites
- **Node.js** (Latest LTS version recommended)
- **npm** (Node Package Manager)
- **OpenAI API Key**

### Installation
1. Clone the repository or download the script files.
2. Navigate to the project directory.
3. Install dependencies using:
   ```sh
   npm install
4. Usage
   ```sh
   USER_PROMPT="Your input text here" OPENAI_API_KEY="your-api-key" node script.js

## Workflow
### Transcript Creation
Uses GPT-4-turbo to generate a structured transcript based on user_prompt
### Text-to-Speech Conversion
Converts the generated transcript into an audio file using OpenAI TTS.
### Image Generation
Extracts key visuals from the transcript and generates images using DALL·E.
### Video Compilation
Stitches the images together with the audio to create a final video output.

## Dependencies
1. openai - For interacting with OpenAI APIs.
2. fs - For file system operations.
3. axios - For downloading images.
4. ffmpeg-static - For video processing.
5. dotenv - For loading environment variables.

## Output
The generated video will be saved as output_video.mp4 in the project directory.
