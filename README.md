# 3D AI Matthew Chatbot 🤖

A cutting-edge 3D AI chatbot that brings Matthew Petersen to life through an interactive 3D avatar with realistic speech synthesis and lip-sync technology. Built with Next.js, Three.js, Microsoft Azure TTS, and Google Gemini AI.

![3D AI Matthew Chatbot](https://img.shields.io/badge/Next.js-15.5.0-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.1.0-blue?style=for-the-badge&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.179.1-black?style=for-the-badge&logo=three.js)
![Azure](https://img.shields.io/badge/Azure-Speech%20Services-blue?style=for-the-badge&logo=microsoft-azure)
![Google AI](https://img.shields.io/badge/Google-Gemini%20AI-orange?style=for-the-badge&logo=google)

## ✨ Features

### 🎭 3D Avatar Technology
- **Realistic 3D Avatar**: Powered by `@met4citizen/talkinghead` library
- **Advanced Lip-Sync**: Real-time viseme mapping from Azure Speech Services
- **Interactive Controls**: Camera rotation, panning, and zooming
- **Mood System**: Configurable avatar emotions and expressions
- **High-Quality Rendering**: 30 FPS model rendering with optimized lighting

### 🗣️ Multi-Language Speech Synthesis
- **25+ Languages Supported**: Including English, French, Spanish, German, Japanese, Korean, Chinese, and more
- **Neural Voice Quality**: Microsoft Azure Cognitive Services with natural-sounding voices
- **Real-time Audio Processing**: Web Audio API integration for seamless playback
- **Viseme Synchronization**: Precise mouth movement mapping for realistic speech

### 🤖 AI-Powered Conversations
- **Google Gemini Integration**: Advanced AI responses using Gemini 2.5 Flash
- **Contextual Memory**: Maintains conversation history for natural interactions
- **Personalized Responses**: Speaks as Matthew Petersen with first-person perspective
- **Smart Link Detection**: Automatic conversion of mentions to clickable links

### 🎨 Modern UI/UX
- **Responsive Design**: Built with Tailwind CSS for all screen sizes
- **Real-time Chat Interface**: Live message building with word-by-word display
- **Interactive Controls**: Intuitive camera and conversation controls
- **Clean Architecture**: Modular React components with TypeScript support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Microsoft Azure Speech Services account
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/3d-ai-matthew-chatbot.git
   cd 3d-ai-matthew-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Azure Speech Services
   AZURE_SPEECH_KEY=your_azure_speech_key_here
   AZURE_SPEECH_REGION=eastus

   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

### Frontend Stack
- **Next.js 15.5.0**: React framework with App Router
- **React 19.1.0**: UI library with latest features
- **Three.js**: 3D graphics and WebGL rendering
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers for Three.js
- **Tailwind CSS**: Utility-first CSS framework

### Backend Services
- **Microsoft Azure Speech Services**: Text-to-speech and viseme generation
- **Google Gemini AI**: Natural language processing and response generation
- **Next.js API Routes**: Serverless backend endpoints

### 3D Avatar System
- **@met4citizen/talkinghead**: Core avatar rendering and animation
- **GLB Model Support**: Ready Player Me avatar compatibility
- **Viseme Mapping**: Azure to Oculus viseme conversion
- **Real-time Animation**: 30 FPS synchronized speech and movement

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── azure-tts/          # Azure TTS API endpoint
│   │   └── chat/               # Gemini AI chat endpoint
│   ├── globals.css             # Global styles
│   ├── layout.js              # Root layout component
│   └── page.js                # Main page component
├── components/
│   ├── ChatUI.js              # Main chat interface
│   └── TalkingHeadDemo.js     # 3D avatar component
├── utils/
│   ├── linkMappings.js        # Link conversion utilities
│   └── voices.js              # Multi-language voice configurations
└── lib/
    └── gemini.js              # Gemini AI integration
```

## 🎯 Key Components

### ChatUI Component
- Manages conversation state and message history
- Handles user input and AI response processing
- Integrates with 3D avatar for speech synthesis
- Provides real-time message building with word-by-word display

### TalkingHeadDemo Component
- Renders and controls the 3D avatar
- Manages speech synthesis and lip-sync
- Handles camera controls and avatar interactions
- Converts Azure visemes to Oculus format for accurate lip-sync

### API Endpoints
- **`/api/chat`**: Processes user messages with Gemini AI
- **`/api/azure-tts`**: Converts text to speech with viseme data

## 🌍 Multi-Language Support

The chatbot supports 25+ languages with native-sounding voices:

| Language | Code | Voice | Language | Code | Voice |
|----------|------|-------|----------|------|-------|
| English | `en` | en-CA-LiamNeural | French | `fr` | fr-CA-AntoineNeural |
| Spanish | `es` | es-ES-AlvaroNeural | German | `de` | de-DE-ConradNeural |
| Italian | `it` | it-IT-DiegoNeural | Portuguese | `pt` | pt-BR-AntonioNeural |
| Japanese | `ja` | ja-JP-KeitaNeural | Korean | `ko` | ko-KR-InJoonNeural |
| Chinese (Mandarin) | `zh` | zh-CN-YunxiNeural | Chinese (Cantonese) | `ct` | zh-HK-WanLungNeural |
| Arabic | `ar` | ar-SA-HamedNeural | Hindi | `hi` | hi-IN-MadhurNeural |
| Russian | `ru` | ru-RU-DmitryNeural | Dutch | `nl` | nl-NL-MaartenNeural |
| Swedish | `sv` | sv-SE-MattiasNeural | Danish | `da` | da-DK-JeppeNeural |
| Norwegian | `no` | nb-NO-FinnNeural | Finnish | `fi` | fi-FI-HarriNeural |
| Polish | `pl` | pl-PL-MarekNeural | Turkish | `tr` | tr-TR-AhmetNeural |
| Vietnamese | `vi` | vi-VN-NamMinhNeural | Thai | `th` | th-TH-SupakornNeural |
| Punjabi | `pa` | pa-IN-OjasNeural | Gujarati | `gu` | gu-IN-NiranjanNeural |

## 🔧 Configuration

### Avatar Settings
```javascript
const head = new TH(avatarRef.current, {
  avatarSpeaking: { HeadMove: 0, EyeContact: 0.5 },
  avatarIdle: { HeadMove: 0, EyeContact: 0.2 },
  lipsyncModules: ["en"],
  lipsyncLang: 'en',
  cameraView: 'upper',
  cameraRotateX: 0.6,
  cameraRotateEnable: true,
  cameraPanEnable: true,
  cameraZoomEnable: true,
  avatarMood: 'happy',
  modelFPS: 30,
  lightAmbientIntensity: 1.5,
  lightDirectIntensity: 20,
  mixerGainSpeech: 1.0,
});
```

### Voice Configuration
Add new languages by updating `src/utils/voices.js`:
```javascript
export const voices = {
  en: "en-CA-LiamNeural",
  fr: "fr-CA-AntoineNeural",
  // Add more languages...
};
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms
- **Netlify**: Compatible with Next.js static export
- **AWS**: Deploy using AWS Amplify or EC2
- **Docker**: Use the included Dockerfile for containerized deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **@met4citizen/talkinghead**: 3D avatar rendering and animation
- **Microsoft Azure**: Speech synthesis and viseme generation
- **Google Gemini**: AI conversation capabilities
- **Three.js Community**: 3D graphics and WebGL support
- **Next.js Team**: React framework and development tools

## 📞 Contact

**Matthew Petersen**
- Email: [matthewp@uwaterloo.ca](mailto:matthewp@uwaterloo.ca)
- LinkedIn: [LinkedIn Profile](https://www.linkedin.com/in/petersen-matthew/)
- GitHub: [GitHub Portfolio](https://github.com/petersenmatthew)
- Website: [Personal Portfolio](https://matthewpetersen.com)
- Twitter: [@mmptrsn](https://twitter.com/mmptrsn)
- Instagram: [@mxtthewpetersen](https://instagram.com/mxtthewpetersen)

---

⭐ **Star this repository if you found it helpful!**

*Built with ❤️ by Matthew Petersen*