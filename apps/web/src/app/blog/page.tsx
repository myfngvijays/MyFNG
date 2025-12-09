'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, Search } from 'lucide-react';

// Sample blog data - In production, this would come from a database
const blogPosts = [
  {
    id: 1,
    slug: '5-essential-car-maintenance-tips-for-monsoon',
    title: '5 Essential Car Maintenance Tips for Monsoon',
    excerpt: 'Protect your car during rainy season with these expert tips. Learn how to prevent water damage, maintain visibility, and keep your vehicle safe.',
    content: `Monsoon season brings heavy rains and challenging driving conditions. Here are 5 essential tips to keep your car in top condition:

1. **Check Your Wipers**: Replace worn-out wiper blades before monsoon starts. Good visibility is crucial during heavy rains.

2. **Inspect Tires**: Ensure proper tire tread depth (minimum 1.6mm). Consider using all-season or rain-specific tires for better grip.

3. **Waterproofing**: Check door seals, window seals, and sunroof drainage to prevent water leakage into the cabin.

4. **Electrical System**: Ensure all lights (headlights, taillights, indicators) are working properly. Water can damage electrical components.

5. **Regular Cleaning**: Clean your car regularly to prevent rust. Pay special attention to undercarriage cleaning after driving through flooded areas.

Following these tips will help protect your investment and ensure safe driving during monsoon season.`,
    date: 'Dec 15, 2024',
    readTime: '5 min read',
    category: 'Maintenance',
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['Maintenance', 'Monsoon', 'Safety']
  },
  {
    id: 2,
    slug: 'how-ai-is-revolutionizing-car-service-industry',
    title: 'How AI is Revolutionizing Car Service Industry',
    excerpt: 'Discover how artificial intelligence is transforming car maintenance, diagnostics, and customer service in the automotive industry.',
    content: `Artificial Intelligence is reshaping the car service industry in unprecedented ways:

**AI-Powered Diagnostics**: Advanced AI algorithms can analyze engine sounds, vibrations, and performance data to detect issues before they become major problems.

**Predictive Maintenance**: Machine learning models predict when your car needs service based on driving patterns, mileage, and component wear.

**Smart Scheduling**: AI optimizes service appointments, reducing wait times and improving workshop efficiency.

**Quality Assurance**: Computer vision AI checks service quality by analyzing before/after photos, ensuring consistent service standards.

**Customer Experience**: AI chatbots provide instant support, answer queries, and guide customers through the service process.

The future of car servicing is here, and it's powered by AI.`,
    date: 'Dec 10, 2024',
    readTime: '7 min read',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['AI', 'Technology', 'Innovation']
  },
  {
    id: 3,
    slug: 'understanding-your-cars-service-schedule',
    title: 'Understanding Your Car\'s Service Schedule',
    excerpt: 'Learn when and why your car needs regular servicing. Understand service intervals, what gets checked, and how to maintain your vehicle.',
    content: `Understanding your car's service schedule is crucial for maintaining its performance and longevity:

**Service Intervals**: Most cars need service every 10,000 km or 6 months, whichever comes first. Check your owner's manual for specific recommendations.

**What Gets Serviced**:
- Engine oil and filter replacement
- Air filter cleaning/replacement
- Brake system inspection
- Tire rotation and alignment
- Battery check
- Fluid top-ups (coolant, brake fluid, power steering)

**Benefits of Regular Service**:
- Improved fuel efficiency
- Extended vehicle lifespan
- Better resale value
- Enhanced safety
- Warranty compliance

**Warning Signs**: Don't wait for scheduled service if you notice unusual sounds, warning lights, or performance issues.

Regular servicing is an investment in your car's future.`,
    date: 'Dec 5, 2024',
    readTime: '6 min read',
    category: 'Education',
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['Service', 'Maintenance', 'Education']
  },
  {
    id: 4,
    slug: 'electric-vehicle-maintenance-guide',
    title: 'Electric Vehicle Maintenance Guide',
    excerpt: 'Everything you need to know about maintaining your electric vehicle. Learn about battery care, charging best practices, and EV-specific maintenance.',
    content: `Electric vehicles (EVs) require different maintenance compared to traditional cars:

**Battery Care**: 
- Keep battery charge between 20-80% for optimal lifespan
- Avoid frequent deep discharges
- Use slow charging when possible

**Tire Maintenance**: EVs are heavier, so tire rotation is more important. Check tire pressure monthly.

**Brake System**: Regenerative braking reduces wear on brake pads, but regular inspection is still needed.

**Cooling System**: Battery and motor cooling systems need periodic checks and fluid replacement.

**Software Updates**: Regular software updates improve performance and add new features.

EVs have fewer moving parts, meaning less maintenance overall, but specialized care is essential.`,
    date: 'Nov 28, 2024',
    readTime: '8 min read',
    category: 'Electric Vehicles',
    image: 'https://images.unsplash.com/photo-1593941707882-a5bac6861d75?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['EV', 'Electric Vehicles', 'Maintenance']
  },
  {
    id: 5,
    slug: 'winter-car-care-essentials',
    title: 'Winter Car Care Essentials',
    excerpt: 'Prepare your car for winter with these essential tips. Learn about battery care, tire maintenance, and cold weather driving safety.',
    content: `Winter brings unique challenges for car owners. Here's how to prepare:

**Battery Check**: Cold weather reduces battery capacity. Test your battery before winter and replace if needed.

**Tire Pressure**: Tire pressure drops in cold weather. Check and maintain proper pressure regularly.

**Antifreeze**: Ensure coolant/antifreeze is at proper levels and concentration to prevent freezing.

**Visibility**: Keep windshield washer fluid topped up with winter-grade fluid that won't freeze.

**Emergency Kit**: Keep a winter emergency kit with blankets, flashlight, jumper cables, and emergency supplies.

**Driving Tips**: 
- Warm up your engine before driving
- Drive slowly and maintain safe distances
- Avoid sudden acceleration or braking

Proper winter preparation ensures your safety and your car's reliability during cold months.`,
    date: 'Nov 20, 2024',
    readTime: '6 min read',
    category: 'Seasonal Care',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['Winter', 'Seasonal', 'Safety']
  },
  {
    id: 6,
    slug: 'choosing-right-motor-oil',
    title: 'Choosing the Right Motor Oil for Your Car',
    excerpt: 'A comprehensive guide to selecting the perfect motor oil. Understand viscosity ratings, synthetic vs conventional, and when to change oil.',
    content: `Choosing the right motor oil is crucial for your engine's health:

**Viscosity Ratings**: 
- 5W-30: Good for most modern cars
- 10W-40: Better for older engines
- 0W-20: For newer, fuel-efficient engines

**Oil Types**:
- **Conventional**: Basic, affordable, needs frequent changes
- **Synthetic**: Better protection, longer intervals, higher cost
- **Synthetic Blend**: Balance between performance and cost

**When to Change**:
- Follow manufacturer recommendations
- Check oil level monthly
- Change every 5,000-10,000 km typically

**Signs You Need an Oil Change**:
- Dark, dirty oil
- Engine noise
- Warning lights
- Reduced fuel efficiency

Using the right oil extends engine life and improves performance.`,
    date: 'Nov 15, 2024',
    readTime: '5 min read',
    category: 'Maintenance',
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=800',
    author: 'MyFNG Team',
    tags: ['Oil', 'Maintenance', 'Engine']
  }
];

const categories = ['All', 'Maintenance', 'Technology', 'Education', 'Electric Vehicles', 'Seasonal Care'];

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-white">Our Blog</h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-200">
              Expert tips, industry insights, and car care advice
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-6 sm:py-7 md:py-8 bg-white border-b border-gray-200">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="relative mb-4 sm:mb-5 md:mb-6">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    selectedCategory === category
                      ? 'bg-brand-primary text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 sm:py-16 md:py-20">
                <p className="text-gray-500 text-sm sm:text-base md:text-lg">No blog posts found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {filteredPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all group"
                  >
                    <div className="h-40 sm:h-44 md:h-48 relative overflow-hidden">
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                        <span className="bg-brand-primary text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold">
                          {post.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-5 md:p-6">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                          {post.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          {post.readTime}
                        </div>
                      </div>
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary mb-2 sm:mb-3 group-hover:text-brand-primary transition line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-brand-primary text-xs sm:text-sm font-semibold">
                        Read More <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

