const ALL_BACKGROUND_VIDEOS = [
  require("../assets/videos/asian_man_indecisive_in_store.mp4"),
  require("../assets/videos/black_man_indecisive_in_store.mp4"),
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

class VideoRandomizerService {
  private shuffledVideos: typeof ALL_BACKGROUND_VIDEOS = [];
  private currentIndex: number = 0;
  private lastShuffleTime: number = 0;

  constructor() {
    this.reshuffle();
  }

  private reshuffle() {
    const videos = [...ALL_BACKGROUND_VIDEOS];
    for (let i = videos.length - 1; i > 0; i--) {
      const seed = Date.now() + Math.random() * 10000;
      const j = Math.floor((seed % (i + 1)));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }
    this.shuffledVideos = videos;
    this.currentIndex = 0;
    this.lastShuffleTime = Date.now();
  }

  getNextVideo() {
    if (Date.now() - this.lastShuffleTime > 30 * 60 * 1000) {
      this.reshuffle();
    }
    
    if (this.currentIndex >= this.shuffledVideos.length) {
      this.reshuffle();
    }

    const video = this.shuffledVideos[this.currentIndex];
    this.currentIndex++;
    return video;
  }

  reset() {
    this.reshuffle();
  }
}

export const videoRandomizer = new VideoRandomizerService();
