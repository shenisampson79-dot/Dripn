import AsyncStorage from "@react-native-async-storage/async-storage";

export type VideoTone = "pain" | "confidence" | "mixed";

const PAIN_MALE_VIDEOS = [
  require("../assets/videos/asian_man_indecisive_in_store.mp4"),
  require("../assets/videos/black_man_indecisive_in_store.mp4"),
  require("../assets/videos/black_man_indecisive_at_home.mp4"),
  require("../assets/videos/white_man_indecisive_in_store.mp4"),
  require("../assets/videos/white_man_indecisive_at_home.mp4"),
];

const PAIN_FEMALE_VIDEOS = [
  require("../assets/videos/asian_woman_indecisive_in_store.mp4"),
  require("../assets/videos/black_woman_indecisive_in_store.mp4"),
  require("../assets/videos/black_woman_choosing_clothes_indecisively.mp4"),
  require("../assets/videos/indian_woman_choosing_clothes_indecisively.mp4"),
  require("../assets/videos/white_woman_indecisive_in_store.mp4"),
  require("../assets/videos/white_woman_wardrobe_indecision_scene.mp4"),
  require("../assets/videos/woman_pondering_outfits_on_bed.mp4"),
  require("../assets/videos/woman_comparing_two_dresses_held_firmly.mp4"),
  require("../assets/videos/woman_trying_tops_with_closed_mouth.mp4"),
];

const CONFIDENCE_MALE_VIDEOS = [
  require("../assets/videos/confidence/conf_male_blue_portrait.mp4"),
  require("../assets/videos/confidence/conf_male_denim_pose.mp4"),
  require("../assets/videos/confidence/conf_male_neon_lights.mp4"),
  require("../assets/videos/confidence/conf_male_denim_neon.mp4"),
  require("../assets/videos/confidence/conf_male_mirror_reflection.mp4"),
];

const CONFIDENCE_FEMALE_VIDEOS = [
  require("../assets/videos/confidence/conf_female_walking_street_night.mp4"),
  require("../assets/videos/confidence/conf_female_neon_sign.mp4"),
  require("../assets/videos/confidence/conf_female_fashion_bar.mp4"),
  require("../assets/videos/confidence/conf_female_night_portrait.mp4"),
  require("../assets/videos/confidence/conf_female_neon_peek.mp4"),
  require("../assets/videos/confidence/conf_female_sports_car.mp4"),
  require("../assets/videos/confidence/conf_female_camaro_lean.mp4"),
];

const STORAGE_KEY = "video_randomizer_state_v2";

interface PoolState {
  maleIndex: number;
  femaleIndex: number;
  shuffledMale: number[];
  shuffledFemale: number[];
}

interface RandomizerState {
  pain: PoolState;
  confidence: PoolState;
  lastGender: "male" | "female";
  timestamp: number;
}

export interface GetNextVideoOptions {
  tone?: VideoTone;
}

class VideoRandomizerService {
  private state: RandomizerState;
  private initialized: boolean = false;

  constructor() {
    this.state = this.createFreshState();
    this.loadState();
  }

  private createPoolState(maleCount: number, femaleCount: number): PoolState {
    return {
      maleIndex: 0,
      femaleIndex: 0,
      shuffledMale: this.createShuffledIndices(maleCount),
      shuffledFemale: this.createShuffledIndices(femaleCount),
    };
  }

  private createFreshState(): RandomizerState {
    return {
      pain: this.createPoolState(PAIN_MALE_VIDEOS.length, PAIN_FEMALE_VIDEOS.length),
      confidence: this.createPoolState(CONFIDENCE_MALE_VIDEOS.length, CONFIDENCE_FEMALE_VIDEOS.length),
      lastGender: Math.random() > 0.5 ? "male" : "female",
      timestamp: Date.now(),
    };
  }

  private createShuffledIndices(length: number): number[] {
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  private resolveTone(tone: VideoTone): "pain" | "confidence" {
    if (tone === "mixed") {
      return Math.random() < 0.6 ? "confidence" : "pain";
    }
    return tone;
  }

  private async loadState() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RandomizerState;
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 && parsed.pain && parsed.confidence) {
          this.state = parsed;
        }
      }
    } catch {
      console.log("Failed to load video randomizer state");
    }
    this.initialized = true;
  }

  private async saveState() {
    try {
      this.state.timestamp = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      console.log("Failed to save video randomizer state");
    }
  }

  getNextVideo(options: GetNextVideoOptions = {}) {
    const resolvedTone = this.resolveTone(options.tone ?? "mixed");
    const poolState = this.state[resolvedTone];
    const maleVideos = resolvedTone === "confidence" ? CONFIDENCE_MALE_VIDEOS : PAIN_MALE_VIDEOS;
    const femaleVideos = resolvedTone === "confidence" ? CONFIDENCE_FEMALE_VIDEOS : PAIN_FEMALE_VIDEOS;

    const useGender = this.state.lastGender === "male" ? "female" : "male";
    this.state.lastGender = useGender;

    if (useGender === "male") {
      if (poolState.maleIndex >= poolState.shuffledMale.length) {
        poolState.shuffledMale = this.createShuffledIndices(maleVideos.length);
        poolState.maleIndex = 0;
      }
      const videoIndex = poolState.shuffledMale[poolState.maleIndex];
      poolState.maleIndex++;
      this.saveState();
      return maleVideos[videoIndex];
    }

    if (poolState.femaleIndex >= poolState.shuffledFemale.length) {
      poolState.shuffledFemale = this.createShuffledIndices(femaleVideos.length);
      poolState.femaleIndex = 0;
    }
    const videoIndex = poolState.shuffledFemale[poolState.femaleIndex];
    poolState.femaleIndex++;
    this.saveState();
    return femaleVideos[videoIndex];
  }

  getVideoForSlot(slotId: string, tone: VideoTone = "mixed") {
    const resolvedTone = this.resolveTone(tone);
    const maleVideos = resolvedTone === "confidence" ? CONFIDENCE_MALE_VIDEOS : PAIN_MALE_VIDEOS;
    const femaleVideos = resolvedTone === "confidence" ? CONFIDENCE_FEMALE_VIDEOS : PAIN_FEMALE_VIDEOS;
    const hash = slotId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

    if (hash % 3 === 0) {
      return maleVideos[hash % maleVideos.length];
    }
    return femaleVideos[hash % femaleVideos.length];
  }

  reset() {
    this.state = this.createFreshState();
    this.saveState();
  }
}

export const videoRandomizer = new VideoRandomizerService();
