export interface Event {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  distance?: number;
  price: string;
  description: string;
  source: string;
  sourceUrl?: string;
  outfitSuggestion: string;
  isVipOnly?: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface EventCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  cityName?: string;
}

const EVENT_TEMPLATES = [
  { title: "Saturday Morning Run Club", category: "Fitness", time: "8:00 AM", dateType: "weekly", price: "Free", description: "Join our community run club - all paces welcome!", source: "Meetup", outfitSuggestion: "Wear your best athleisure - leggings, trainers, and a light jacket", radius: 5 },
  { title: "Sip & Paint Evening", category: "Social", time: "7:00 PM", dateType: "upcoming", price: "$35", description: "Paint, sip wine, and make new friends in a relaxed creative atmosphere", source: "Eventbrite", outfitSuggestion: "Smart casual - something you do not mind getting paint on!", radius: 10 },
  { title: "Local Farmers Market", category: "Lifestyle", time: "9:00 AM - 2:00 PM", dateType: "weekly", price: "Free entry", description: "Fresh produce, artisan goods, and street food from local vendors", source: "Local Council", outfitSuggestion: "Countryside chic - comfortable shoes, tote bag, relaxed layers", radius: 8 },
  { title: "Pilates in the Park", category: "Fitness", time: "6:30 PM", dateType: "recurring", price: "Free", description: "Outdoor Pilates sessions for all levels", source: "ClassPass", outfitSuggestion: "Matching workout set - Gymshark or Lululemon would be perfect", radius: 3 },
  { title: "Speed Dating for Professionals", category: "Dating", time: "7:30 PM", dateType: "upcoming", price: "$25", description: "Meet like-minded singles in a fun, relaxed environment", source: "TodayTix", outfitSuggestion: "Date night outfit - smart casual, something that makes you feel confident", radius: 15 },
  { title: "Gymshark Pop-Up Event", category: "Fashion", time: "10:00 AM - 6:00 PM", dateType: "upcoming", price: "Free", description: "Exclusive launches, athlete meet-and-greets, and special discounts", source: "Gymshark", outfitSuggestion: "Head-to-toe athleisure - show off your Gymshark collection!", radius: 20, isVipOnly: true },
  { title: "Live Jazz & Cocktails", category: "Music", time: "8:00 PM", dateType: "weekly", price: "$15", description: "Live jazz performances with craft cocktails", source: "Secret London", outfitSuggestion: "Elegant evening wear - think smart casual with a touch of glamour", radius: 12 },
  { title: "Hiking Group Meetup", category: "Outdoor", time: "9:00 AM", dateType: "upcoming", price: "Free", description: "Scenic 5-mile hike with photo opportunities", source: "Meetup", outfitSuggestion: "Practical outdoor wear - hiking boots, layers, and a quality backpack", radius: 25 },
  { title: "Yoga at Sunset", category: "Fitness", time: "6:00 PM", dateType: "weekly", price: "$10", description: "Relaxing yoga session with beautiful sunset views", source: "ClassPass", outfitSuggestion: "Comfortable yoga wear - stretchy and breathable fabrics", radius: 7 },
  { title: "Art Gallery Opening", category: "Social", time: "7:00 PM", dateType: "upcoming", price: "Free", description: "Exclusive preview of new contemporary art exhibition", source: "Timeout", outfitSuggestion: "Smart casual with an artistic edge - express your creativity", radius: 10 },
  { title: "Paris Fashion Week Getaway", category: "Flights", time: "Departs 6:00 AM", dateType: "upcoming", price: "From $299", description: "Fly to Paris for Fashion Week - exclusive VIP access and styling events", source: "Skyscanner", outfitSuggestion: "Chic travel outfit - comfortable yet stylish for the journey", radius: 0, isVipOnly: true },
  { title: "Milan Design District Trip", category: "Flights", time: "Departs 8:30 AM", dateType: "upcoming", price: "From $249", description: "Weekend trip to Milan's famous design and fashion district", source: "Kayak", outfitSuggestion: "Italian-inspired elegance - tailored pieces and quality accessories", radius: 0, isVipOnly: true },
  { title: "NYC Shopping Weekend", category: "Flights", time: "Departs 7:00 AM", dateType: "upcoming", price: "From $189", description: "Shop the best of New York - SoHo, Fifth Avenue, and Brooklyn boutiques", source: "Google Flights", outfitSuggestion: "Comfortable walking shoes and layers for varying store temperatures", radius: 0 },
  { title: "Dubai Luxury Experience", category: "Flights", time: "Departs 10:00 PM", dateType: "upcoming", price: "From $499", description: "Experience Dubai's luxury malls and exclusive designer boutiques", source: "Skyscanner", outfitSuggestion: "Modest yet stylish - respect local customs while staying fashionable", radius: 0, isVipOnly: true },
];

class EventsServiceImpl {
  private events: Event[] = [];
  private lastFetchTime: number = 0;
  private lastLocation: LocationData | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async fetchEvents(location?: LocationData): Promise<Event[]> {
    const now = Date.now();
    
    if (
      this.events.length > 0 &&
      now - this.lastFetchTime < this.CACHE_DURATION &&
      this.isSameLocation(location, this.lastLocation)
    ) {
      return this.events;
    }

    await this.simulateNetworkDelay();

    const cityName = location?.cityName || "your area";
    const shuffled = [...EVENT_TEMPLATES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6 + Math.floor(Math.random() * 4));

    this.events = selected.map((template, index) => {
      const distance = location ? this.calculateMockDistance(template.radius) : undefined;
      const locationName = this.generateLocationName(template.category, cityName);
      
      return {
        id: `event-${now}-${index}`,
        title: template.title,
        category: template.category,
        date: this.getDateString(template.dateType),
        time: template.time,
        location: locationName,
        distance,
        price: template.price,
        description: template.description,
        source: template.source,
        outfitSuggestion: template.outfitSuggestion,
        isVipOnly: template.isVipOnly,
        coordinates: location ? this.generateNearbyCoordinates(location, template.radius) : undefined,
      };
    });

    if (location) {
      this.events.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    this.lastFetchTime = now;
    this.lastLocation = location || null;
    return this.events;
  }

  async refreshEvents(location?: LocationData): Promise<Event[]> {
    this.lastFetchTime = 0;
    this.events = [];
    return this.fetchEvents(location);
  }

  getCategories(events: Event[]): EventCategory[] {
    const categoryMap = new Map<string, number>();
    
    events.forEach(event => {
      const count = categoryMap.get(event.category) || 0;
      categoryMap.set(event.category, count + 1);
    });

    const categoryIcons: Record<string, string> = {
      "Fitness": "activity",
      "Social": "users",
      "Lifestyle": "coffee",
      "Dating": "heart",
      "Fashion": "shopping-bag",
      "Music": "music",
      "Outdoor": "sun",
      "Flights": "navigation",
    };

    const categories: EventCategory[] = [
      { id: "All", name: "All", icon: "grid", count: events.length },
    ];

    categoryMap.forEach((count, name) => {
      categories.push({ 
        id: name, 
        name, 
        icon: categoryIcons[name] || "calendar",
        count,
      });
    });

    return categories.sort((a, b) => {
      if (a.id === "All") return -1;
      if (b.id === "All") return 1;
      return b.count - a.count;
    });
  }

  filterEvents(events: Event[], category: string, isVip: boolean): Event[] {
    return events.filter(event => {
      if (event.isVipOnly && !isVip) return false;
      if (category !== "All" && event.category !== category) return false;
      return true;
    });
  }

  private isSameLocation(loc1?: LocationData, loc2?: LocationData | null): boolean {
    if (!loc1 && !loc2) return true;
    if (!loc1 || !loc2) return false;
    const threshold = 0.01;
    return (
      Math.abs(loc1.latitude - loc2.latitude) < threshold &&
      Math.abs(loc1.longitude - loc2.longitude) < threshold
    );
  }

  private calculateMockDistance(maxRadius: number): number | undefined {
    if (maxRadius === 0) return undefined;
    return Math.round((Math.random() * maxRadius + 0.5) * 10) / 10;
  }

  private generateLocationName(category: string, cityName: string): string {
    const venues: Record<string, string[]> = {
      "Fitness": ["Central Park", "Sports Center", "Community Gym", "Riverside Trail"],
      "Social": ["Art Studio", "Community Center", "Rooftop Bar", "Gallery Space"],
      "Lifestyle": ["Town Square", "Market Street", "Main Street Plaza", "City Center"],
      "Dating": ["Cocktail Lounge", "Wine Bar", "Rooftop Terrace", "Bistro"],
      "Fashion": ["Shopping District", "Design Quarter", "Fashion Hub", "Pop-Up Space"],
      "Music": ["Jazz Club", "Concert Hall", "Live Music Venue", "The Blue Note"],
      "Outdoor": ["Nature Reserve", "Hiking Trail", "Scenic Viewpoint", "Park Entrance"],
    };

    const venueList = venues[category] || ["Local Venue"];
    const venue = venueList[Math.floor(Math.random() * venueList.length)];
    return `${venue}, ${cityName}`;
  }

  private generateNearbyCoordinates(location: LocationData, radiusKm: number): { latitude: number; longitude: number } {
    const latOffset = (Math.random() - 0.5) * (radiusKm / 111);
    const lngOffset = (Math.random() - 0.5) * (radiusKm / 111);
    return {
      latitude: location.latitude + latOffset,
      longitude: location.longitude + lngOffset,
    };
  }

  private getDateString(dateType: string): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    
    switch (dateType) {
      case "weekly":
        const randomDay = days[Math.floor(Math.random() * 7)];
        return `Every ${randomDay}`;
      case "recurring":
        const day1 = days[Math.floor(Math.random() * 5) + 1];
        const day2 = days[Math.floor(Math.random() * 5) + 1];
        return `${day1}s & ${day2}s`;
      case "upcoming":
        const daysFromNow = Math.floor(Math.random() * 14) + 1;
        const futureDate = new Date(today.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
        if (daysFromNow === 1) return "Tomorrow";
        if (daysFromNow <= 7) return `This ${days[futureDate.getDay()]}`;
        return `${futureDate.getDate()} ${futureDate.toLocaleString('default', { month: 'short' })}`;
      default:
        return "This Week";
    }
  }

  private async simulateNetworkDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
  }
}

export const EventsService = new EventsServiceImpl();

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "Fitness": "activity",
    "Social": "users",
    "Lifestyle": "coffee",
    "Dating": "heart",
    "Fashion": "shopping-bag",
    "Music": "music",
    "Outdoor": "sun",
    "Flights": "navigation",
  };
  return icons[category] || "calendar";
}

export function estimateTravelTime(distanceKm: number): string {
  const walkingSpeed = 5;
  const drivingSpeed = 40;
  
  if (distanceKm <= 2) {
    const walkMins = Math.max(1, Math.round((distanceKm / walkingSpeed) * 60));
    return walkMins < 5 ? "< 5 min walk" : `${walkMins} min walk`;
  } else {
    const driveMins = Math.max(1, Math.round((distanceKm / drivingSpeed) * 60));
    return driveMins < 5 ? "< 5 min drive" : `${driveMins} min drive`;
  }
}

export function getMapsUrl(coordinates: { latitude: number; longitude: number }, title: string, platform: 'ios' | 'android' | 'web'): string {
  const encodedTitle = encodeURIComponent(title);
  const { latitude, longitude } = coordinates;
  const encodedCoords = encodeURIComponent(`${latitude},${longitude}`);
  
  if (platform === 'ios') {
    return `http://maps.apple.com/?saddr=Current+Location&daddr=${encodedTitle}@${latitude},${longitude}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encodedCoords}&travelmode=driving`;
}
