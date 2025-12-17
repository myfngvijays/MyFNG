'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowLeft, Calendar, Clock, Share2, Tag } from 'lucide-react';
import { useState } from 'react';

// Sample blog data - In production, this would come from a database
const blogPosts: Record<string, {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  author: string;
  tags: string[];
}> = {
  '5-essential-car-maintenance-tips-for-monsoon': {
    id: 1,
    slug: '5-essential-car-maintenance-tips-for-monsoon',
    title: '5 Essential Car Maintenance Tips for Monsoon',
    excerpt: 'Protect your car during rainy season with these expert tips. Learn how to prevent water damage, maintain visibility, and keep your vehicle safe.',
    content: `Monsoon season brings heavy rains and challenging driving conditions. Here are 5 essential tips to keep your car in top condition:

## 1. Check Your Wipers

Replace worn-out wiper blades before monsoon starts. Good visibility is crucial during heavy rains. Look for:
- Smooth rubber without cracks
- Proper contact with windshield
- No streaking or skipping

**When to replace**: Every 6-12 months or when you notice reduced visibility.

## 2. Inspect Tires

Ensure proper tire tread depth (minimum 1.6mm). Consider using all-season or rain-specific tires for better grip.

**Tire Safety Checklist**:
- Check tread depth regularly
- Maintain proper tire pressure
- Look for uneven wear patterns
- Consider tire rotation

## 3. Waterproofing

Check door seals, window seals, and sunroof drainage to prevent water leakage into the cabin.

**Common Leak Points**:
- Door weatherstripping
- Window seals
- Sunroof drains
- Trunk seals

## 4. Electrical System

Ensure all lights (headlights, taillights, indicators) are working properly. Water can damage electrical components.

**Electrical Safety**:
- Test all lights before monsoon
- Check battery terminals for corrosion
- Inspect wiring for damage
- Keep electrical components dry

## 5. Regular Cleaning

Clean your car regularly to prevent rust. Pay special attention to undercarriage cleaning after driving through flooded areas.

**Cleaning Tips**:
- Wash immediately after driving through water
- Focus on undercarriage cleaning
- Apply rust protection
- Keep drainage channels clear

Following these tips will help protect your investment and ensure safe driving during monsoon season.`,
    date: 'Dec 15, 2024',
    readTime: '5 min read',
    category: 'Maintenance',
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['Maintenance', 'Monsoon', 'Safety']
  },
  'how-ai-is-revolutionizing-car-service-industry': {
    id: 2,
    slug: 'how-ai-is-revolutionizing-car-service-industry',
    title: 'How AI is Revolutionizing Car Service Industry',
    excerpt: 'Discover how artificial intelligence is transforming car maintenance, diagnostics, and customer service in the automotive industry.',
    content: `Artificial Intelligence is reshaping the car service industry in unprecedented ways:

## AI-Powered Diagnostics

Advanced AI algorithms can analyze engine sounds, vibrations, and performance data to detect issues before they become major problems. This predictive approach helps:

- Identify potential failures early
- Reduce unexpected breakdowns
- Lower maintenance costs
- Extend vehicle lifespan

## Predictive Maintenance

Machine learning models predict when your car needs service based on:
- Driving patterns
- Mileage and usage
- Component wear patterns
- Environmental factors

This ensures timely maintenance and prevents costly repairs.

## Smart Scheduling

AI optimizes service appointments by:
- Analyzing workshop capacity
- Predicting service duration
- Optimizing technician assignments
- Reducing wait times

## Quality Assurance

Computer vision AI checks service quality by analyzing before/after photos, ensuring:
- Consistent service standards
- Complete work verification
- Quality compliance
- Customer satisfaction

## Customer Experience

AI chatbots provide:
- Instant support 24/7
- Quick query resolution
- Service recommendations
- Appointment scheduling

The future of car servicing is here, and it's powered by AI.`,
    date: 'Dec 10, 2024',
    readTime: '7 min read',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['AI', 'Technology', 'Innovation']
  },
  'understanding-your-cars-service-schedule': {
    id: 3,
    slug: 'understanding-your-cars-service-schedule',
    title: 'Understanding Your Car\'s Service Schedule',
    excerpt: 'Learn when and why your car needs regular servicing. Understand service intervals, what gets checked, and how to maintain your vehicle.',
    content: `Understanding your car's service schedule is crucial for maintaining its performance and longevity:

## Service Intervals

Most cars need service every 10,000 km or 6 months, whichever comes first. Check your owner's manual for specific recommendations.

**Factors Affecting Service Frequency**:
- Vehicle age
- Driving conditions
- Mileage
- Manufacturer recommendations

## What Gets Serviced

### Engine Oil and Filter
- Oil change every 5,000-10,000 km
- Filter replacement with oil change
- Check oil level monthly

### Air Filter
- Cleaning every 10,000 km
- Replacement every 20,000-30,000 km
- More frequent in dusty conditions

### Brake System
- Inspection every service
- Pad replacement as needed
- Fluid check and top-up

### Tires
- Rotation every 10,000 km
- Alignment check
- Pressure monitoring

### Battery
- Terminal cleaning
- Charge level check
- Replacement when needed

## Benefits of Regular Service

- **Improved fuel efficiency**: Up to 10% better mileage
- **Extended vehicle lifespan**: Proper maintenance adds years
- **Better resale value**: Well-maintained cars fetch higher prices
- **Enhanced safety**: Regular checks prevent failures
- **Warranty compliance**: Maintains manufacturer warranty

## Warning Signs

Don't wait for scheduled service if you notice:
- Unusual sounds or vibrations
- Warning lights on dashboard
- Performance issues
- Fluid leaks
- Reduced fuel efficiency

Regular servicing is an investment in your car's future.`,
    date: 'Dec 5, 2024',
    readTime: '6 min read',
    category: 'Education',
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['Service', 'Maintenance', 'Education']
  },
  'electric-vehicle-maintenance-guide': {
    id: 4,
    slug: 'electric-vehicle-maintenance-guide',
    title: 'Electric Vehicle Maintenance Guide',
    excerpt: 'Everything you need to know about maintaining your electric vehicle. Learn about battery care, charging best practices, and EV-specific maintenance.',
    content: `Electric vehicles (EVs) require different maintenance compared to traditional cars:

## Battery Care

**Charging Best Practices**:
- Keep battery charge between 20-80% for optimal lifespan
- Avoid frequent deep discharges
- Use slow charging when possible
- Don't charge to 100% regularly

**Battery Health**:
- Monitor battery degradation
- Avoid extreme temperatures
- Use manufacturer-recommended chargers

## Tire Maintenance

EVs are heavier due to battery weight, so:
- Tire rotation is more important
- Check tire pressure monthly
- Replace tires when tread depth is low
- Consider EV-specific tires

## Brake System

Regenerative braking reduces wear on brake pads, but:
- Regular inspection is still needed
- Brake fluid checks are important
- Caliper maintenance required
- System testing recommended

## Cooling System

Battery and motor cooling systems need:
- Periodic checks
- Fluid replacement
- System cleaning
- Temperature monitoring

## Software Updates

Regular software updates:
- Improve performance
- Add new features
- Fix bugs
- Enhance battery management

EVs have fewer moving parts, meaning less maintenance overall, but specialized care is essential for optimal performance.`,
    date: 'Nov 28, 2024',
    readTime: '8 min read',
    category: 'Electric Vehicles',
    image: 'https://images.unsplash.com/photo-1593941707882-a5bac6861d75?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['EV', 'Electric Vehicles', 'Maintenance']
  },
  'winter-car-care-essentials': {
    id: 5,
    slug: 'winter-car-care-essentials',
    title: 'Winter Car Care Essentials',
    excerpt: 'Prepare your car for winter with these essential tips. Learn about battery care, tire maintenance, and cold weather driving safety.',
    content: `Winter brings unique challenges for car owners. Here's how to prepare:

## Battery Check

Cold weather reduces battery capacity by up to 50%. Before winter:
- Test your battery
- Check terminals for corrosion
- Replace if battery is 3+ years old
- Keep battery fully charged

## Tire Pressure

Tire pressure drops in cold weather:
- Check pressure monthly
- Maintain manufacturer-recommended PSI
- Consider winter tires in cold regions
- Check tire condition regularly

## Antifreeze

Ensure coolant/antifreeze is:
- At proper levels
- Correct concentration (usually 50/50)
- Tested for freeze protection
- Replaced every 2-3 years

## Visibility

Keep windshield washer fluid:
- Topped up with winter-grade fluid
- Won't freeze at low temperatures
- Contains de-icing agents
- Check wiper blades condition

## Emergency Kit

Keep a winter emergency kit with:
- Blankets and warm clothing
- Flashlight with extra batteries
- Jumper cables
- Emergency supplies
- First aid kit
- Ice scraper and snow brush

## Driving Tips

**Before Driving**:
- Warm up your engine
- Clear all snow and ice
- Check lights and signals

**While Driving**:
- Drive slowly
- Maintain safe distances
- Avoid sudden acceleration
- Avoid sudden braking
- Use lower gears on hills

Proper winter preparation ensures your safety and your car's reliability during cold months.`,
    date: 'Nov 20, 2024',
    readTime: '6 min read',
    category: 'Seasonal Care',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['Winter', 'Seasonal', 'Safety']
  },
  'choosing-right-motor-oil': {
    id: 6,
    slug: 'choosing-right-motor-oil',
    title: 'Choosing the Right Motor Oil for Your Car',
    excerpt: 'A comprehensive guide to selecting the perfect motor oil. Understand viscosity ratings, synthetic vs conventional, and when to change oil.',
    content: `Choosing the right motor oil is crucial for your engine's health:

## Viscosity Ratings

**Understanding the Numbers**:
- 5W-30: Good for most modern cars, works in various temperatures
- 10W-40: Better for older engines, thicker at operating temperature
- 0W-20: For newer, fuel-efficient engines, thinner for better mileage

**What the Numbers Mean**:
- First number (5W): Cold weather viscosity
- Second number (30): Operating temperature viscosity
- Lower numbers = thinner oil

## Oil Types

### Conventional Oil
- Basic, affordable option
- Needs frequent changes (every 3,000-5,000 km)
- Good for older vehicles
- Lower cost per quart

### Synthetic Oil
- Better protection and performance
- Longer change intervals (up to 15,000 km)
- Better in extreme temperatures
- Higher cost but better value

### Synthetic Blend
- Balance between performance and cost
- Better than conventional
- More affordable than full synthetic
- Good for most vehicles

## When to Change Oil

**Follow Manufacturer Recommendations**:
- Check your owner's manual
- Modern cars: 7,500-10,000 km
- Older cars: 3,000-5,000 km
- Check oil level monthly

**Signs You Need an Oil Change**:
- Dark, dirty oil on dipstick
- Engine noise or knocking
- Warning lights on dashboard
- Reduced fuel efficiency
- Exhaust smoke

## Oil Change Process

1. Warm up engine slightly
2. Drain old oil completely
3. Replace oil filter
4. Add new oil to proper level
5. Check for leaks
6. Reset service reminder

Using the right oil extends engine life and improves performance. Always consult your owner's manual or a trusted mechanic.`,
    date: 'Nov 15, 2024',
    readTime: '5 min read',
    category: 'Maintenance',
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=1200',
    author: 'MyFNG Team',
    tags: ['Oil', 'Maintenance', 'Engine']
  }
};

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [copied, setCopied] = useState(false);

  const post = blogPosts[slug];

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 sm:px-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Blog Post Not Found</h1>
          <p className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8">The blog post you're looking for doesn't exist.</p>
          <Link href="/blogs" className="btn btn-primary text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-3">
            Back to Blogs
          </Link>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Convert markdown-like content to HTML (simple version)
  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl sm:text-2xl font-bold text-brand-secondary mt-6 sm:mt-7 md:mt-8 mb-3 sm:mb-4">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={index} className="font-semibold text-sm sm:text-base text-gray-900 mb-1.5 sm:mb-2">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.trim() === '') {
        return <br key={index} />;
      }
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 sm:ml-5 md:ml-6 mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-700">{line.replace('- ', '')}</li>;
      }
      return <p key={index} className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Header */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/blogs"
              className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-200 hover:text-white mb-4 sm:mb-5 md:mb-6 transition text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to Blogs
            </Link>
            <div className="mb-3 sm:mb-4">
              <span className="bg-brand-primary text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                {post.category}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-5 md:mb-6 text-white">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-gray-200 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {post.date}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {post.readTime}
              </div>
              <div>
                By {post.author}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      <section className="py-6 sm:py-7 md:py-8">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src={post.image}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-6 sm:py-7 md:py-8">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <article className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12">
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6 sm:mb-7 md:mb-8">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>

              {/* Content */}
              <div className="prose prose-sm sm:prose-base md:prose-lg max-w-none">
                {formatContent(post.content)}
              </div>

              {/* Share Button */}
              <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-7 md:pt-8 border-t border-gray-200">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-700 text-xs sm:text-sm md:text-base font-semibold"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  {copied ? 'Link Copied!' : 'Share this Article'}
                </button>
              </div>
            </article>

            {/* Related Posts */}
            <div className="mt-10 sm:mt-12 md:mt-16">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-secondary mb-6 sm:mb-7 md:mb-8">Related Articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {Object.values(blogPosts)
                  .filter(p => p.id !== post.id && p.category === post.category)
                  .slice(0, 3)
                  .map((relatedPost) => (
                    <Link
                      key={relatedPost.id}
                      href={`/blogs/${relatedPost.slug}`}
                      className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden hover:shadow-xl transition group"
                    >
                      <div className="h-32 sm:h-36 md:h-40 relative overflow-hidden">
                        <Image
                          src={relatedPost.image}
                          alt={relatedPost.title}
                          fill
                          className="object-cover group-hover:scale-105 transition duration-500"
                        />
                      </div>
                      <div className="p-3 sm:p-4">
                        <h3 className="font-bold text-sm sm:text-base text-brand-secondary mb-1.5 sm:mb-2 group-hover:text-brand-primary transition line-clamp-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-gray-500">{relatedPost.date}</p>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

