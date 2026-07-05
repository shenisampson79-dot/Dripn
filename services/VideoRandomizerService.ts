import AsyncStorage from "@react-native-async-storage/async-storage";

const MALE_VIDEOS = [
  require("../assets/videos/asian_man_indecisive_in_store.mp4"),
  require("../assets/videos/black_man_indecisive_in_store.mp4"),
  require("../assets/videos/black_man_indecisive_at_home.mp4"),
  require("../assets/videos/white_man_indecisive_in_store.mp4"),
  require("../assets/videos/white_man_indecisive_at_home.mp4"),
];

const FEMALE_VIDEOS = [
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

const ALL_BACKGROUND_VIDEOS = [...MALE_VIDEOS, ...FEMALE_VIDEOS];

const STORAGE_KEY = "video_randomizer_state";

interface RandomizerState {
  maleIndex: number;
  femaleIndex: number;
  shuffledMale: number[];
  shuffledFemale: number[];
  lastGender: "male" | "female";
  timestamp: number;
}

class VideoRandomizerService {
  private state: RandomizerState;
  private initialized: boolean = false;

  constructor() {
    this.state = this.createFreshState();
    this.loadState();
  }

  private createFreshState(): RandomizerState {
    return {
      maleIndex: 0,
      femaleIndex: 0,
      shuffledMale: this.createShuffledIndices(MALE_VIDEOS.length),
      shuffledFemale: this.createShuffledIndices(FEMALE_VIDEOS.length),
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

  private async loadState() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RandomizerState;
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.state = parsed;
        }
      }
    } catch (e) {
      console.log("Failed to load video randomizer state");
    }
    this.initialized = true;
  }

  private async saveState() {
    try {
      this.state.timestamp = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.log("Failed to save video randomizer state");
    }
  }

  getNextVideo(_options?: { tone?: string }) {
    const useGender = this.state.lastGender === "male" ? "female" : "male";
    this.state.lastGender = useGender;

    if (useGender === "male") {
      if (this.state.maleIndex >= this.state.shuffledMale.length) {
        this.state.shuffledMale = this.createShuffledIndices(MALE_VIDEOS.length);
        this.state.maleIndex = 0;
      }
      const videoIndex = this.state.shuffledMale[this.state.maleIndex];
      this.state.maleIndex++;
      this.saveState();
      return MALE_VIDEOS[videoIndex];
    } else {
      if (this.state.femaleIndex >= this.state.shuffledFemale.length) {
        this.state.shuffledFemale = this.createShuffledIndices(FEMALE_VIDEOS.length);
        this.state.femaleIndex = 0;
      }
      const videoIndex = this.state.shuffledFemale[this.state.femaleIndex];
      this.state.femaleIndex++;
      this.saveState();
      return FEMALE_VIDEOS[videoIndex];
    }
  }

  getVideoForSlot(slotId: string): typeof ALL_BACKGROUND_VIDEOS[0] {
    const hash = slotId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    if (hash % 3 === 0) {
      return MALE_VIDEOS[hash % MALE_VIDEOS.length];
    } else {
      return FEMALE_VIDEOS[hash % FEMALE_VIDEOS.length];
    }
  }

  reset() {
    this.state = this.createFreshState();
    this.saveState();
  }
}

export const videoRandomizer = new VideoRandomizerService();
