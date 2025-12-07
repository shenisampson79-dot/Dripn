export interface Event {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  distance?: number;
  price: string;
  priceValue?: number;
  currency: string;
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

export function getCurrencyForCountry(country: string): { symbol: string; code: string; rate: number } {
  if (country === "United Kingdom" || country === "Isle of Man" || country === "Jersey" || country === "Guernsey" || country === "Gibraltar") {
    return { symbol: "£", code: "GBP", rate: 0.79 };
  }
  if (country === "Ireland") return { symbol: "€", code: "EUR", rate: 0.92 };
  if (["Germany", "France", "Italy", "Spain", "Netherlands", "Belgium", "Austria", "Portugal", "Greece", "Finland"].includes(country)) {
    return { symbol: "€", code: "EUR", rate: 0.92 };
  }
  if (country === "Australia") return { symbol: "A$", code: "AUD", rate: 1.53 };
  if (country === "Canada") return { symbol: "C$", code: "CAD", rate: 1.36 };
  if (country === "Japan") return { symbol: "¥", code: "JPY", rate: 149.5 };
  if (country === "India") return { symbol: "₹", code: "INR", rate: 83.2 };
  if (country === "Brazil") return { symbol: "R$", code: "BRL", rate: 4.97 };
  if (country === "Mexico") return { symbol: "MX$", code: "MXN", rate: 17.15 };
  if (country === "South Africa") return { symbol: "R", code: "ZAR", rate: 18.5 };
  if (country === "China") return { symbol: "¥", code: "CNY", rate: 7.24 };
  if (country === "South Korea") return { symbol: "₩", code: "KRW", rate: 1320 };
  if (country === "Singapore") return { symbol: "S$", code: "SGD", rate: 1.34 };
  if (country === "United Arab Emirates") return { symbol: "AED", code: "AED", rate: 3.67 };
  if (country === "New Zealand") return { symbol: "NZ$", code: "NZD", rate: 1.63 };
  if (country === "Switzerland") return { symbol: "CHF", code: "CHF", rate: 0.88 };
  if (country === "Sweden") return { symbol: "kr", code: "SEK", rate: 10.42 };
  if (country === "Norway") return { symbol: "kr", code: "NOK", rate: 10.65 };
  if (country === "Denmark") return { symbol: "kr", code: "DKK", rate: 6.87 };
  if (country === "Poland") return { symbol: "zł", code: "PLN", rate: 3.98 };
  return { symbol: "$", code: "USD", rate: 1 };
}

export function formatPriceForCountry(priceUSD: number, country: string): string {
  const currency = getCurrencyForCountry(country);
  const convertedPrice = priceUSD * currency.rate;
  if (currency.code === "JPY" || currency.code === "KRW") {
    return `${currency.symbol}${Math.round(convertedPrice).toLocaleString()}`;
  }
  return `${currency.symbol}${convertedPrice.toFixed(2)}`;
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
  { title: "Live Football Match", category: "Sports", time: "3:00 PM", dateType: "weekly", priceValue: 45, pricePrefix: "From ", description: "Watch your local team play live at the stadium", source: "Official Club", outfitSuggestion: "Football casual - Stone Island jumper or C.P. Company jacket with straight-leg jeans and white trainers. Lyle & Scott polo is also a classic match day choice.", radius: 15 },
  { title: "Premier League Matchday", category: "Sports", time: "12:30 PM", dateType: "upcoming", priceValue: 65, pricePrefix: "From ", description: "Premier League action - experience the atmosphere of English football", source: "Ticketmaster", outfitSuggestion: "Classic terrace style - Stone Island badge jumper, quality straight-leg jeans, and crisp white trainers. C.P. Company soft shell for colder days.", radius: 25 },
  { title: "Championship Football", category: "Sports", time: "7:45 PM", dateType: "upcoming", priceValue: 30, pricePrefix: "From ", description: "Midweek Championship football under the lights", source: "Official Club", outfitSuggestion: "Layer up for evening kick-off - Lyle & Scott quarter zip with Stone Island overshirt, straight jeans, and clean white trainers", radius: 20 },
  { title: "FA Cup Match", category: "Sports", time: "5:30 PM", dateType: "upcoming", priceValue: 40, pricePrefix: "From ", description: "The magic of the FA Cup - knockout football at its finest", source: "FA", outfitSuggestion: "Cup day calls for your best - premium Stone Island jumper or C.P. Company goggle jacket with quality denim and box-fresh white trainers", radius: 30 },
  { title: "Saturday Morning Run Club", category: "Fitness", time: "8:00 AM", dateType: "weekly", priceValue: 0, pricePrefix: "", description: "Join our community run club - all paces welcome!", source: "Meetup", outfitSuggestion: "Wear your best athleisure - leggings, trainers, and a light jacket", radius: 5 },
  { title: "Sip & Paint Evening", category: "Social", time: "7:00 PM", dateType: "upcoming", priceValue: 35, pricePrefix: "", description: "Paint, sip wine, and make new friends in a relaxed creative atmosphere", source: "Eventbrite", outfitSuggestion: "Smart casual - something you do not mind getting paint on!", radius: 10 },
  { title: "Local Farmers Market", category: "Lifestyle", time: "9:00 AM - 2:00 PM", dateType: "weekly", priceValue: 0, pricePrefix: "", description: "Fresh produce, artisan goods, and street food from local vendors", source: "Local Council", outfitSuggestion: "Countryside chic - comfortable shoes, tote bag, relaxed layers", radius: 8 },
  { title: "Pilates in the Park", category: "Fitness", time: "6:30 PM", dateType: "recurring", priceValue: 0, pricePrefix: "", description: "Outdoor Pilates sessions for all levels", source: "ClassPass", outfitSuggestion: "Matching workout set - Gymshark or Lululemon would be perfect", radius: 3 },
  { title: "Speed Dating for Professionals", category: "Dating", time: "7:30 PM", dateType: "upcoming", priceValue: 25, pricePrefix: "", description: "Meet like-minded singles in a fun, relaxed environment", source: "TodayTix", outfitSuggestion: "Date night outfit - smart casual, something that makes you feel confident", radius: 15 },
  { title: "Gymshark Pop-Up Event", category: "Fashion", time: "10:00 AM - 6:00 PM", dateType: "upcoming", priceValue: 0, pricePrefix: "", description: "Exclusive launches, athlete meet-and-greets, and special discounts", source: "Gymshark", outfitSuggestion: "Head-to-toe athleisure - show off your Gymshark collection!", radius: 20, isVipOnly: true },
  { title: "Live Jazz & Cocktails", category: "Music", time: "8:00 PM", dateType: "weekly", priceValue: 15, pricePrefix: "", description: "Live jazz performances with craft cocktails", source: "Secret London", outfitSuggestion: "Elegant evening wear - think smart casual with a touch of glamour", radius: 12 },
  { title: "Hiking Group Meetup", category: "Outdoor", time: "9:00 AM", dateType: "upcoming", priceValue: 0, pricePrefix: "", description: "Scenic 5-mile hike with photo opportunities", source: "Meetup", outfitSuggestion: "Practical outdoor wear - hiking boots, layers, and a quality backpack", radius: 25 },
  { title: "Yoga at Sunset", category: "Fitness", time: "6:00 PM", dateType: "weekly", priceValue: 10, pricePrefix: "", description: "Relaxing yoga session with beautiful sunset views", source: "ClassPass", outfitSuggestion: "Comfortable yoga wear - stretchy and breathable fabrics", radius: 7 },
  { title: "Art Gallery Opening", category: "Social", time: "7:00 PM", dateType: "upcoming", priceValue: 0, pricePrefix: "", description: "Exclusive preview of new contemporary art exhibition", source: "Timeout", outfitSuggestion: "Smart casual with an artistic edge - express your creativity", radius: 10 },
  { title: "Paris Fashion Week Getaway", category: "Flights", time: "Departs 6:00 AM", dateType: "upcoming", priceValue: 299, pricePrefix: "From ", description: "Fly to Paris for Fashion Week - exclusive VIP access and styling events", source: "Skyscanner", outfitSuggestion: "Chic travel outfit - comfortable yet stylish for the journey", radius: 0, isVipOnly: true },
  { title: "Milan Design District Trip", category: "Flights", time: "Departs 8:30 AM", dateType: "upcoming", priceValue: 249, pricePrefix: "From ", description: "Weekend trip to Milan's famous design and fashion district", source: "Kayak", outfitSuggestion: "Italian-inspired elegance - tailored pieces and quality accessories", radius: 0, isVipOnly: true },
  { title: "NYC Shopping Weekend", category: "Flights", time: "Departs 7:00 AM", dateType: "upcoming", priceValue: 189, pricePrefix: "From ", description: "Shop the best of New York - SoHo, Fifth Avenue, and Brooklyn boutiques", source: "Google Flights", outfitSuggestion: "Comfortable walking shoes and layers for varying store temperatures", radius: 0 },
  { title: "Dubai Luxury Experience", category: "Flights", time: "Departs 10:00 PM", dateType: "upcoming", priceValue: 499, pricePrefix: "From ", description: "Experience Dubai's luxury malls and exclusive designer boutiques", source: "Skyscanner", outfitSuggestion: "Modest yet stylish - respect local customs while staying fashionable", radius: 0, isVipOnly: true },
];

class EventsServiceImpl {
  private events: Event[] = [];
  private lastFetchTime: number = 0;
  private lastLocation: LocationData | null = null;
  private lastCountry: string = "";
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async fetchEvents(location?: LocationData, userCountry?: string): Promise<Event[]> {
    const now = Date.now();
    const country = userCountry || "United States";
    
    if (
      this.events.length > 0 &&
      now - this.lastFetchTime < this.CACHE_DURATION &&
      this.isSameLocation(location, this.lastLocation) &&
      this.lastCountry === country
    ) {
      return this.events;
    }

    await this.simulateNetworkDelay();

    const cityName = location?.cityName || "your area";
    const shuffled = [...EVENT_TEMPLATES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6 + Math.floor(Math.random() * 4));
    const currencyInfo = getCurrencyForCountry(country);

    this.events = selected.map((template, index) => {
      const distance = location ? this.calculateMockDistance(template.radius) : undefined;
      const locationName = this.generateLocationName(template.category, cityName);
      
      let price: string;
      if (template.priceValue === 0) {
        price = "Free";
      } else {
        const convertedPrice = template.priceValue * currencyInfo.rate;
        const formattedPrice = currencyInfo.code === "JPY" || currencyInfo.code === "KRW" 
          ? Math.round(convertedPrice).toLocaleString() 
          : convertedPrice.toFixed(2);
        price = `${template.pricePrefix}${currencyInfo.symbol}${formattedPrice}`;
      }
      
      return {
        id: `event-${now}-${index}`,
        title: template.title,
        category: template.category,
        date: this.getDateString(template.dateType),
        time: template.time,
        location: locationName,
        distance,
        price,
        priceValue: template.priceValue,
        currency: currencyInfo.code,
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
    this.lastCountry = country;
    return this.events;
  }

  async refreshEvents(location?: LocationData, userCountry?: string): Promise<Event[]> {
    this.lastFetchTime = 0;
    this.events = [];
    return this.fetchEvents(location, userCountry);
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
      "Sports": "award",
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
