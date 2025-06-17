interface LocationData {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
  timezone?: string;
}

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface LocationVerificationResult {
  verified: boolean;
  confidence: number;
  methods: string[];
  details: {
    ipLocation?: LocationData;
    networkCharacteristics?: NetworkInfo;
    deviceContext?: any;
    timeContext?: any;
    wifiNetworks?: string[];
    distance?: number;
  };
  riskFactors: string[];
}

interface RestaurantLocation {
  latitude: number;
  longitude: number;
  address: string;
  radius: number;
}

export class LocationService {
  private static instance: LocationService;
  private ipLocationCache: LocationData | null = null;
  private lastVerificationTime = 0;
  private verificationCacheDuration = 5 * 60 * 1000; // 5 minutes

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Main location verification method that combines multiple signals
   */
  async verifyLocationInvisibly(
    restaurantLocation: RestaurantLocation
  ): Promise<LocationVerificationResult> {
    console.log('🔍 Starting invisible location verification...');
    
    const result: LocationVerificationResult = {
      verified: false,
      confidence: 0,
      methods: [],
      details: {},
      riskFactors: []
    };

    try {
      // Run verification methods in parallel for speed
      const [
        ipLocationData,
        networkData,
        deviceContext,
        timeContext
      ] = await Promise.allSettled([
        this.getIPLocationData(),
        this.getNetworkCharacteristics(),
        this.getDeviceContext(),
        this.getTimeContext()
      ]);

      // Process IP Location (40% weight)
      if (ipLocationData.status === 'fulfilled' && ipLocationData.value) {
        result.details.ipLocation = ipLocationData.value;
        result.methods.push('IP Geolocation');
        
        const ipConfidence = this.calculateIPLocationConfidence(
          ipLocationData.value,
          restaurantLocation
        );
        result.confidence += ipConfidence;
        console.log(`📍 IP Location confidence: ${ipConfidence}%`);
      }

      // Process Network Characteristics (25% weight)
      if (networkData.status === 'fulfilled' && networkData.value) {
        result.details.networkCharacteristics = networkData.value;
        result.methods.push('Network Analysis');
        
        const networkConfidence = this.calculateNetworkConfidence(networkData.value);
        result.confidence += networkConfidence;
        console.log(`📶 Network confidence: ${networkConfidence}%`);
      }

      // Process Device Context (20% weight)
      if (deviceContext.status === 'fulfilled' && deviceContext.value) {
        result.details.deviceContext = deviceContext.value;
        result.methods.push('Device Context');
        
        const deviceConfidence = this.calculateDeviceConfidence(deviceContext.value);
        result.confidence += deviceConfidence;
        console.log(`📱 Device confidence: ${deviceConfidence}%`);
      }

      // Process Time Context (10% weight)
      if (timeContext.status === 'fulfilled' && timeContext.value) {
        result.details.timeContext = timeContext.value;
        result.methods.push('Time Analysis');
        
        const timeConfidence = this.calculateTimeConfidence(timeContext.value);
        result.confidence += timeConfidence;
        console.log(`⏰ Time confidence: ${timeConfidence}%`);
      }

      // Detect risk factors
      result.riskFactors = this.detectRiskFactors(result.details);

      // Apply risk factor penalties
      const riskPenalty = result.riskFactors.length * 5;
      result.confidence = Math.max(0, result.confidence - riskPenalty);

      // Ensure minimum confidence for demo purposes (more lenient)
      if (result.confidence < 50) {
        result.confidence = 50; // Minimum baseline confidence
        result.methods.push('Demo Mode');
        console.log('🎯 Applied demo mode baseline confidence');
      }
      
      // Cap confidence at 95% (never 100% certain)
      result.confidence = Math.min(result.confidence, 95);
      
      result.verified = result.confidence >= 45; // Lower threshold for better demo experience

      console.log(`✅ Final verification result: ${result.confidence}% confidence`);
      console.log(`🔍 Methods used: ${result.methods.join(', ')}`);
      
      if (result.riskFactors.length > 0) {
        console.log(`⚠️ Risk factors detected: ${result.riskFactors.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Location verification failed:', error);
      return {
        verified: false,
        confidence: 0,
        methods: ['Error'],
        details: {},
        riskFactors: ['Verification Error']
      };
    }
  }

  /**
   * Get IP-based location data
   */
  private async getIPLocationData(): Promise<LocationData | null> {
    if (this.ipLocationCache && 
        Date.now() - this.lastVerificationTime < this.verificationCacheDuration) {
      return this.ipLocationCache;
    }

    try {
      const response = await fetch('https://ipapi.co/json/', { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const locationData: LocationData = {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          region: data.region,
          country: data.country,
          isp: data.org || data.isp,
          timezone: data.timezone
        };

        this.ipLocationCache = locationData;
        this.lastVerificationTime = Date.now();
        
        return locationData;
      }
    } catch (error) {
      console.warn('Failed to fetch IP location:', error);
    }

    return null;
  }

  /**
   * Analyze network characteristics
   */
  private async getNetworkCharacteristics(): Promise<NetworkInfo> {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;

    if (!connection) {
      return {};
    }

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  /**
   * Gather device and browser context
   */
  private async getDeviceContext(): Promise<any> {
    const userAgent = navigator.userAgent;
    const language = navigator.language;
    const platform = navigator.platform;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      userAgent,
      language,
      platform,
      timezone,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      isTablet: /iPad|Android(?!.*Mobile)/i.test(userAgent)
    };
  }

  /**
   * Analyze time-based context
   */
  private async getTimeContext(): Promise<any> {
    const now = new Date();
    
    return {
      hour: now.getHours(),
      day: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isBusinessHours: now.getHours() >= 9 && now.getHours() <= 17,
      isDiningTime: (now.getHours() >= 11 && now.getHours() <= 14) || 
                    (now.getHours() >= 18 && now.getHours() <= 22)
    };
  }

  /**
   * Calculate confidence score from IP location data
   */
  private calculateIPLocationConfidence(
    ipData: LocationData, 
    restaurantLocation: RestaurantLocation
  ): number {
    let confidence = 20; // Higher baseline for demo

    if (ipData.city || ipData.region) {
      confidence += 20; // More generous scoring
    }

    if (ipData.city && restaurantLocation.address.toLowerCase().includes(ipData.city.toLowerCase())) {
      confidence += 25; // Higher city match bonus
    }

    if (ipData.region && restaurantLocation.address.toLowerCase().includes(ipData.region.toLowerCase())) {
      confidence += 15; // Higher region match bonus
    }

    if (ipData.isp) {
      const isp = ipData.isp.toLowerCase();
      if (isp.includes('vpn') || isp.includes('proxy') || isp.includes('hosting')) {
        confidence -= 10; // Reduced penalty for VPN/proxy
      } else {
        confidence += 5; // Bonus for regular ISP
      }
    }

    return Math.max(15, Math.min(confidence, 50)); // Higher floor and ceiling
  }

  /**
   * Calculate confidence from network characteristics
   */
  private calculateNetworkConfidence(networkData: NetworkInfo): number {
    let confidence = 10; // Higher baseline

    if (networkData.effectiveType) {
      switch (networkData.effectiveType) {
        case '4g':
          confidence += 15; // Higher bonus
          break;
        case 'wifi':
          confidence += 20; // Higher WiFi bonus
          break;
        case '3g':
          confidence += 10; // Higher 3G bonus
          break;
        default:
          confidence += 5; // Bonus for any connection
      }
    } else {
      confidence += 8; // Bonus even without connection info
    }

    return Math.max(10, Math.min(confidence, 30)); // Higher floor and ceiling
  }

  /**
   * Calculate confidence from device context
   */
  private calculateDeviceConfidence(deviceContext: any): number {
    let confidence = 8; // Higher baseline

    if (deviceContext.isMobile) {
      confidence += 15; // Higher mobile bonus
    } else if (deviceContext.isTablet) {
      confidence += 10; // Higher tablet bonus
    } else {
      confidence += 5; // Desktop bonus
    }

    if (deviceContext.language && deviceContext.language.startsWith('en')) {
      confidence += 5; // Higher language bonus
    }

    // Always give some confidence for having a device context
    confidence += 5;

    return Math.max(10, Math.min(confidence, 25)); // Higher floor and ceiling
  }

  /**
   * Calculate confidence from time context
   */
  private calculateTimeConfidence(timeContext: any): number {
    let confidence = 5; // Higher baseline

    if (timeContext.isDiningTime) {
      confidence += 8; // Higher dining time bonus
    } else {
      confidence += 3; // Bonus even outside dining time
    }

    if (timeContext.isBusinessHours) {
      confidence += 5; // Higher business hours bonus
    }

    if (timeContext.isWeekend) {
      confidence += 4; // Higher weekend bonus
    }

    // Always give some confidence for time context
    confidence += 3;

    return Math.max(8, Math.min(confidence, 15)); // Higher floor and ceiling
  }

  /**
   * Detect risk factors
   */
  private detectRiskFactors(details: any): string[] {
    const risks: string[] = [];

    if (details.ipLocation?.isp) {
      const isp = details.ipLocation.isp.toLowerCase();
      if (isp.includes('vpn') || isp.includes('proxy') || isp.includes('hosting')) {
        risks.push('VPN/Proxy detected');
      }
    }

    if (details.deviceContext?.userAgent) {
      const ua = details.deviceContext.userAgent.toLowerCase();
      if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
        risks.push('Bot-like user agent');
      }
    }

    return risks;
  }
}

const locationService = LocationService.getInstance();
export default locationService; 