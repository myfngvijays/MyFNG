import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const FAQ_SECTIONS = [
  {
    title: 'General',
    items: [
      {
        question: 'What is My FNG',
        answer:
          'My FNG Friendly Neighbourhood Garage is a network of over 100+ multibrand car servicing and repair stations across Mumbai, Navi Mumbai, Thane and Palghar. We connect car owners to A grade service centers to ensure hasslefree and highquality maintenance experiences.',
      },
      {
        question: 'What brands of cars do you service at My FNG',
        answer: 'My FNG services all major car brands. Our skilled technicians are trained to handle a wide range of vehicle makes and models ensuring comprehensive care for your car.',
      },
      {
        question: 'How can I find a My FNG service center near me',
        answer: 'You can find the nearest My FNG service center by visiting our website and using the location finder tool or by calling our customer support for assistance.',
      },
      {
        question: 'What services does My FNG offer',
        answer: 'My FNG offers a wide range of services including routine maintenance oil changes brake repairs engine diagnostics tire services and complex repairs. Our service centers are equipped to handle all your car servicing needs.',
      },
      {
        question: 'How can I book a service appointment with My FNG',
        answer: 'You can book a service appointment online through our website or by calling our customer support. We offer flexible scheduling to accommodate your convenience.',
      },
      {
        question: 'Are the technicians at My FNG certified',
        answer: 'Yes all technicians at My FNG are highly skilled and certified. They undergo rigorous training and use stateoftheart equipment to deliver superior service quality.',
      },
      {
        question: 'Do you use genuine parts for repairs and servicing',
        answer: 'Yes My FNG uses only genuine and highquality parts for all repairs and servicing. We prioritize the longevity and performance of your vehicle.',
      },
      {
        question: 'Is there a warranty on the services provided by My FNG',
        answer: 'Yes My FNG offers a warranty on the services and parts used. Please check with our website for specific warranty details.',
      },
      {
        question: 'How do I know if my car needs servicing',
        answer: 'Regular maintenance schedules warning lights on your dashboard unusual noises and decreased performance are common indicators that your car needs servicing. You can also refer to your vehicle manual.',
      },
      {
        question: 'Can I get an estimate before the service is performed',
        answer: 'Yes My FNG provides detailed estimates before any service or repair work is performed. This ensures transparency and allows you to make informed decisions about your car.',
      },
      {
        question: 'Is There A Warranty On The Services Provided',
        answer: 'Yes we offer a 1000 Kms or 1 Month Warranty on the parts and labour involved in your cars service. Warranty details are also available on our website www.myfng.in.',
      },
      {
        question: 'How Can I Contact You For More Questions',
        answer: 'If you have any additional questions or need assistance you can reach out to us via our website www.myfng.in or call us at +919167779696. Our customer support team is here to help.',
      },
      {
        question: 'What Payment Options Are Available For Car Services',
        answer: 'We accept various payment methods including creditdebit cards UPI and cash. For any specific questions about payment feel free to ask when booking your service or call us at +919167779696.',
      },
    ],
  },
  {
    title: 'Periodic Car Service',
    items: [
      {
        question: 'Can Periodic Car Service Improve My Cars Fuel Efficiency',
        answer: 'Yes regular servicing can enhance your cars fuel efficiency by ensuring all systems are functioning optimally. This includes replacing filters maintaining proper tire pressure and keeping the engine welltuned.',
      },
      {
        question: 'How Long Will The Car Service Take',
        answer: 'The time required for a periodic service depends on the work needed and your cars condition. On average a standard service may take between 5 to 6 hours. We will provide you with an estimated time during the booking process.',
      },
      {
        question: 'What Should I Do If I Notice Any Issues Between Services',
        answer: 'If you notice any unusual sounds vibrations or dashboard warning lights contact us immediately for a diagnostic check. Addressing problems early can prevent more significant repairs.',
      },
      {
        question: 'Will You Use Genuine Parts During The Service',
        answer: 'Yes at My FNG we use only genuine parts and highquality materials to ensure your cars reliability and performance. This also helps maintain the manufacturers warranty.',
      },
      {
        question: 'Why Should I Keep Records Of My Cars Services',
        answer: 'Keeping records of your cars service history is important for warranty compliance resale value and tracking any recurring issues. It also helps you stay informed about your cars maintenance needs.',
      },
      {
        question: 'How Can I Book A Car Service Appointment',
        answer: 'You can easily schedule a service appointment online by visiting our website www.myfng.in or by calling us at +919167779696.',
      },
      {
        question: 'What Fluids Are Checked During A Periodic Car Service',
        answer: 'During a periodic service we check and topup essential fluids such as engine oil coolant brake fluid power steering fluid and windshield washer fluid to ensure your car runs efficiently.',
      },
      {
        question: 'What Does A Typical Periodic Car Service Include',
        answer: 'A typical service includes an oil change air and fuel filter replacements fluid level checks brake inspection tire rotation and a general checkup of essential systems. Spare part replacements are charged at actual cost and our service packages use companyrecommended oil and filters for optimal performance.',
      },
      {
        question: 'How Often Should I Service My Car',
        answer: 'Its generally recommended to service your car every 10000 kilometers or every 6 months whichever comes first. This ensures your car remains in optimal condition. We also offer a 1000 Kms or 1 Month Warranty on our services for added peace of mind.',
      },
      {
        question: 'Why Is Periodic Service Necessary For Every Car',
        answer: 'Periodic car service is essential to maintain your cars safety performance and longevity. Regular servicing helps identify problems early preventing costly repairs and keeping your car in its best condition.',
      },
      {
        question: 'How Is My FNG Periodic Car Service Better Compared To Other Car Services',
        answer: 'At My FNG we focus on delivering highquality car services using genuine parts and companyrecommended oils and filters to ensure your car performs at its best. We offer a 1000 Kms or 1 Month Warranty on our services ensuring peace of mind. Our expert technicians use advanced diagnostic tools and we provide transparent pricing with spare parts charged at actual cost. Additionally our convenient online booking system and customer support set us apart from the competition.',
      },
    ],
  },
  {
    title: 'Car AC Service',
    items: [
      {
        question: 'Why is regular car AC service important',
        answer: 'Regular AC service keeps your cars air conditioning system working efficiently providing proper cooling and air quality. It helps prevent refrigerant leaks maintains system efficiency and prevents costly repairs by addressing issues early.',
      },
      {
        question: 'How often should I service my cars AC',
        answer: 'Its recommended to service your cars AC every 12 months or before the summer season to ensure proper cooling. Regular servicing also helps maintain your AC systems performance and longevity.',
      },
      {
        question: 'What does a typical car AC service at My FNG include',
        answer:
          'At My FNG a typical AC service includes: Gas Charging: Recharging the AC system with refrigerant gas to restore cooling efficiency. Check Refrigerant Level: Ensuring the refrigerant level is adequate for proper functioning. Leak Detection: Inspecting the system for any leaks in the refrigerant lines or components. Vacuuming the AC System: Removing any moisture and contaminants from the system. Recharging AC Gas: Refilling the refrigerant gas to the appropriate level. Pressure Testing: Ensuring the system holds pressure and operates as expected. Performance Check: Verifying the cooling efficiency after servicing.',
      },
      {
        question: 'What are the signs that my cars AC needs servicing',
        answer: 'Signs your cars AC needs servicing include: Reduced cooling performance. Unusual odors from the AC vents. Strange noises when the AC is running. Warm air blowing from the vents. Increased time for cooling the cabin. Water leakage inside the car.',
      },
      {
        question: 'How is My FNGs AC service different from other service providers',
        answer: 'At My FNG we use genuine parts and companyrecommended refrigerants ensuring highquality and reliable AC performance. We also provide a 1000 Kms or 1 Month Warranty on all AC services offering you peace of mind. Our technicians use advanced diagnostic tools to ensure precise service.',
      },
      {
        question: 'What is AC gas charging and why is it necessary',
        answer: 'AC gas charging refers to refilling your cars air conditioning system with the correct amount of refrigerant gas. This is essential to maintain proper cooling performance. Low refrigerant levels can result in reduced cooling and potential damage to AC components like the compressor.',
      },
      {
        question: 'How do you detect leaks in the AC system',
        answer: 'We use specialized leak detection tools to identify any leaks in your cars AC system. This includes inspecting the refrigerant lines compressor condenser and evaporator. If a leak is found our technicians will inform you and recommend repairs.',
      },
      {
        question: 'How long does a car AC service take at My FNG',
        answer: 'A standard car AC service at My FNG typically depends on the condition of your AC system. The time may vary based on diagnostics and the specific needs of your AC. For more complex issues such as leak repairs the service may take longer. When you schedule your appointment we will provide an estimated time based on the assessment of your cars AC system.',
      },
      {
        question: 'Can AC service improve my cars fuel efficiency',
        answer: 'Yes maintaining a properly functioning AC system can improve fuel efficiency. When the AC is in good condition it reduces the strain on the engine leading to more efficient fuel consumption.',
      },
      {
        question: 'Will I be charged for spare parts during AC service',
        answer: 'If any parts need replacement during your AC service they will be charged at actual cost. We ensure transparency in pricing and all spare parts used are genuine and companyrecommended.',
      },
      {
        question: 'What happens if my AC system needs repairs beyond a standard service',
        answer: 'If our technicians find that your AC system requires repairs such as fixing a refrigerant leak or replacing a component we will inform you and provide an estimate before proceeding. You can decide whether to approve the repair.',
      },
      {
        question: 'What should I do if my cars AC is still not cooling properly after service',
        answer: 'If your cars AC is not performing well after a service contact us immediately. Our 1000 Kms or 1 Month Warranty covers any issues that arise after servicing. We will inspect and resolve the problem as part of our warranty.',
      },
      {
        question: 'How can I book an AC service with My FNG',
        answer: 'Booking an AC service with My FNG is simple. You can schedule an appointment online by visiting our website www.myfng.in or call us directly at +919167779696. Our team will assist you with the booking process.',
      },
    ],
  },
  {
    title: 'Car Engine Service',
    items: [
      {
        question: 'How can I book an engine service with My FNG',
        answer: 'You can book your engine service by visiting our website www.myfng.in or by calling us at +919167779696. Our team will assist you with booking the service and providing an estimated time for completion.',
      },
      {
        question: 'Why is engine service important for my car',
        answer: 'Regular engine service keeps your car performing efficiently enhances fuel economy and prevents major repairs. It includes checking essential components and ensuring everything is in proper working order which prolongs your cars engine life.',
      },
      {
        question: 'How often should I get my cars engine serviced',
        answer: 'Its generally recommended to get your cars engine serviced every 6 months or every 10000 kilometers. However always refer to your cars manual for manufacturerspecific service intervals.',
      },
      {
        question: 'What does an engine service at My FNG include',
        answer:
          'My FNG offers a complete Engine Maintenance Package that includes: Complete Engine Bay CheckUp Engine Tuning Minor Wiring RepairsTapping Belt and Hose Inspection Cooling System Check Spark Plug Cleaning and Adjustment Air Filter Cleaning Throttle Body Spray. This package focuses on labor and any required parts will be charged at actual cost.',
      },
      {
        question: 'What are the signs that my cars engine needs servicing',
        answer: 'Common signs include: Dashboard warning lights e.g. check engine light Rough idling or stalling Strange engine noises Excessive exhaust smoke Reduced fuel efficiency.',
      },
      {
        question: 'How is My FNG engine service different from others',
        answer: 'At My FNG we use genuine parts and companyrecommended oils ensuring superior engine care. Our Engine Maintenance Package includes a thorough checkup and we offer a 1000 Kms or 1 Month Warranty for all services.',
      },
      {
        question: 'What does the Engine Maintenance Package cover',
        answer:
          'The Engine Maintenance Package includes labor for complete engine checkups tuning minor wiring repairs belt and hose inspections cooling system checks spark plug cleaning air filter cleaning and throttle body spray. Parts are charged at actual cost if needed.',
      },
      {
        question: 'How does engine service improve my cars performance',
        answer: 'Regular engine service improves fuel efficiency engine smoothness and reduces emissions. It ensures components like the spark plugs air filters and fluids are in top condition allowing your engine to run smoothly.',
      },
      {
        question: 'What happens if I delay my engine service',
        answer: 'Delaying engine service can lead to decreased performance overheating and even engine failure. Prolonging service intervals can cause damage to critical components increasing the cost of repairs.',
      },
      {
        question: 'Will I be charged for spare parts during engine service',
        answer: 'Yes spare parts will be charged at actual cost if required during the service. We ensure transparency and youll be informed before any parts are replaced.',
      },
      {
        question: 'How long does an engine service take at My FNG',
        answer: 'A standard car engine service at My FNG depends on the condition of your engine. The time required may vary based on diagnostics and any specific needs identified during the checkup. For more complex issues such as major repairs the service may take longer. When you schedule your appointment we will provide an estimated time based on the assessment of your cars engine.',
      },
      {
        question: 'What should I do if I notice engine issues between services',
        answer: 'If you notice unusual sounds engine knocking rough idling or any warning lights contact us immediately. Timely diagnostics can prevent more serious problems and expensive repairs.',
      },
      {
        question: 'Do you offer any warranty on engine service',
        answer: 'Yes we offer a 1000 Kms or 1 Month Warranty on engine services which covers parts and labor ensuring peace of mind after the service.',
      },
      {
        question: 'How can I increase the lifespan of my cars engine',
        answer: 'Regular engine maintenance timely oil changes and replacing wornout parts can extend your engines lifespan. Avoid aggressive driving and keep the cooling system in good condition for better engine health.',
      },
    ],
  },
  {
    title: 'Car Battery Service',
    items: [
      {
        question: 'How can I book a battery service with My FNG',
        answer: 'You can book a battery service by visiting our website www.myfng.in or calling us at +919167779696. Our team will assist you with scheduling and provide all necessary details.',
      },
      {
        question: 'Why is regular battery maintenance important',
        answer: 'Regular battery maintenance ensures reliable starting performance and prevents unexpected breakdowns. It also helps extend the battery lifespan and keeps your cars electrical system functioning optimally.',
      },
      {
        question: 'How often should I have my car battery checked',
        answer: 'Its recommended to have your car battery checked every 6 months or at the beginning of extreme weather seasons. Regular checks help prevent potential issues and ensure that your battery is in good condition.',
      },
      {
        question: 'What does a battery service at My FNG include',
        answer:
          'Our comprehensive battery service includes: Battery Inspection: Assessing the condition and connections of the battery. Battery Testing: Evaluating the batterys charge and performance. Clean Terminals: Removing corrosion from battery terminals. Battery Charging: Charging a depleted battery to restore its power. Battery Jump Start: Providing a quick jump start for vehicles with dead batteries. Replacement: Installing a new battery if necessary.',
      },
      {
        question: 'How do I know if my car battery needs replacing',
        answer: 'Signs that your car battery may need replacing include: Difficulty starting the engine. Dim headlights or electrical issues. Swollen or leaking battery case. Battery warning light on the dashboard. Battery age over 35 years.',
      },
      {
        question: 'How is My FNGs battery service different from others',
        answer: 'At My FNG we provide a thorough inspection and testing using advanced diagnostic tools. We only use highquality genuine batteries and offer clear pricing. Our services include both Battery Charging and Battery Jump Start to ensure your car is always ready to go.',
      },
      {
        question: 'What is included in a Battery Jump Start service',
        answer:
          'The Battery Jump Start service includes: Assess Battery Condition: Evaluating the state of the battery. Attempt to Start the Dead Vehicle: Using jumper cables to start the vehicle. Check Battery and Charging System: Ensuring the battery and charging system are functioning properly. Advise on Battery Replacement: Providing recommendations if a replacement is needed.',
      },
      {
        question: 'What does a Battery Charging service involve',
        answer:
          'Our Battery Charging service includes: Inspect Battery Condition: Checking the battery for any visible issues. Check Charge Level: Measuring the current charge level of the battery. Charge Battery: Restoring power to a depleted battery. Test Battery Performance: Ensuring the battery performs well after charging.',
      },
      {
        question: 'How long does a battery service take at My FNG',
        answer: 'A typical battery service including inspection testing and either charging or replacement usually takes about 30 minutes to 1 hour. The duration can vary based on the service required and the condition of your vehicle.',
      },
      {
        question: 'What should I do if my car battery dies',
        answer: 'If your car battery dies contact us for assistance. We offer emergency Battery Jump Start services and can also provide a Battery Charging service if needed.',
      },
      {
        question: 'Will I be charged extra for a new battery',
        answer: 'If a new battery is required it will be charged at actual cost. We ensure transparency in our pricing and provide options for highquality batteries that suit your vehicles needs.',
      },
      {
        question: 'Can extreme weather affect my car battery',
        answer: 'Yes extreme temperatures can impact battery performance. Cold weather can reduce starting power while hot weather can cause overheating and shorten battery lifespan.',
      },
      {
        question: 'What happens if I ignore battery maintenance',
        answer: 'Ignoring battery maintenance can lead to unexpected failures poor performance and potential damage to your cars electrical system. Regular maintenance helps avoid these issues and ensures reliable operation.',
      },
      {
        question: 'How can I increase the lifespan of my car battery',
        answer: 'To extend your battery lifespan have it regularly inspected avoid short trips keep the terminals clean and address any parasitic drain that could affect performance.',
      },
    ],
  },
  {
    title: 'Car Brake Service',
    items: [
      {
        question: 'How can I book a brake service with My FNG',
        answer: 'You can book a brake service by visiting our website www.myfng.in or calling us at +919167779696. Our team will assist you with scheduling and provide all necessary details.',
      },
      {
        question: 'How often should I have my brakes checked',
        answer: 'It is recommended to have your brakes checked every 6 months or every 10000 kilometers. If you notice any unusual noises or performance issues have your brakes inspected immediately.',
      },
      {
        question: 'Why is regular brake maintenance important',
        answer: 'Regular brake maintenance is essential for your safety on the road. Proper maintenance ensures reliable stopping power prevents accidents and reduces the risk of brake failure. Routine checks help detect issues early and maintain your vehicles braking performance.',
      },
      {
        question: 'What does a brake service at My FNG include',
        answer:
          'Our brake service includes: Brake Pad Replacement: Replacing worn brake pads. Brake Fluid Check: Checking and replacing brake fluid if necessary. Comprehensive Brake System Inspection: Inspecting the entire braking system for issues. FrontRear Brake Pads and Discs Cleaning: Cleaning pads and discs for better performance. Caliper Cleaning and Greasing: Ensuring smooth caliper operation. Rear Liners and Drums Cleaning: Cleaning rear liners and drums. Liner Adjustment: Adjusting liners for optimal performance. This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What is included in the Brake Booster Replacement service',
        answer:
          'The Brake Booster Replacement service includes: Removing Old and Fitting New Booster: Replacing the old brake booster with a new one. Draining Old Brake Oil and Filling New Brake Oil: Ensuring the brake system has fresh brake oil. Brake Bleeding: Removing air from the brake lines to ensure proper brake function. This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What does Brake Cylinders Replacement involve',
        answer:
          'The Brake Cylinders Replacement service involves: Brake Bleeding: Ensuring all air is removed from the brake system. Removing Old and Fitting New Cylinders: Replacing old brake cylinders with new ones. TopUp with New Brake Oil: Filling the brake system with fresh brake oil. This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What are the signs that my brakes need servicing',
        answer: 'Signs that your brakes may need servicing include: Squeaking or grinding noises when braking. A spongy or soft brake pedal. Vibrations or pulsations when braking. Warning lights on the dashboard. Pulling to one side while braking.',
      },
      {
        question: 'How long does a brake service take at My FNG',
        answer: 'A standard brake service typically depends on brake issues. The duration may vary based on your vehicles condition and the type of service required. We will provide an estimated time during the booking process.',
      },
      {
        question: 'Will you charge extra for brake parts',
        answer: 'Yes if any brake parts need replacement they will be charged at actual cost. We ensure transparent pricing and will inform you of any additional costs before proceeding with repairs.',
      },
      {
        question: 'Can I drive safely with wornout brakes',
        answer: 'Driving with wornout brakes is dangerous and can significantly affect your ability to stop safely. Its essential to have your brakes serviced immediately if you notice any signs of wear or reduced performance.',
      },
      {
        question: 'How often should brake fluid be replaced',
        answer: 'Brake fluid should be replaced every 2 years or as specified in your vehicles manual. Regular replacement helps maintain brake system performance and prevent brake fade.',
      },
      {
        question: 'How can I extend the life of my brakes',
        answer: 'To extend your brake lifespan avoid aggressive driving maintain proper tire pressure and have regular brake inspections. Smooth driving and avoiding heavy braking can also help reduce wear on your brake components.',
      },
      {
        question: 'Can brake service improve my cars performance',
        answer: 'Yes regular brake service ensures that your braking system functions correctly which can improve overall vehicle performance. Properly maintained brakes provide better stopping power and a smoother driving experience.',
      },
      {
        question: 'What happens if I ignore brake maintenance',
        answer: 'Ignoring brake maintenance can lead to severe safety issues including brake failure and reduced stopping power. It can also result in more costly repairs and potential damage to other braking system components.',
      },
    ],
  },
  {
    title: 'Car Tyre & Wheel Care',
    items: [
      {
        question: 'How can I book a tyre service with My FNG',
        answer: 'You can book a tyre service by visiting our website www.myfng.in or calling us at +919167779696. Our team will assist you with scheduling and provide all necessary details.',
      },
      {
        question: 'Why is regular tyre maintenance important',
        answer: 'Regular tyre maintenance is crucial for vehicle safety optimal performance and fuel efficiency. Properly maintained tyres provide better traction handling and braking performance. Regular checks also help extend the lifespan of your tyres and prevent unexpected breakdowns.',
      },
      {
        question: 'How often should I have my tyres inspected',
        answer: 'It is recommended to have your tyres inspected every 6 months or every 10000 kilometers. Regular inspections help identify issues like uneven wear damage or incorrect pressure ensuring your tyres remain in good condition.',
      },
      {
        question: 'What does a tyre service at My FNG include',
        answer:
          'Our tyre service includes: Tyre Rotation: Moving tyres from one position to another to ensure even wear. Balancing: Ensuring that each tyre is balanced properly to prevent vibrations. Alignment: Adjusting the wheel alignment to prevent uneven wear and improve handling. Pressure Check and Adjustment: Checking and adjusting tyre pressure for optimal performance. Tyre Replacement: Replacing worn or damaged tyres with new ones. This includes only labor charges parts and tyres will be billed at actual cost.',
      },
      {
        question: 'How can I tell if my tyres need to be replaced',
        answer: 'Signs that your tyres need replacement include: Tread depth below 1.6 mm. Visible cracks or bulges on the sidewalls. Uneven wear patterns. Loss of traction or handling issues. Frequent punctures or leaks.',
      },
      {
        question: 'What is tyre balancing and why is it important',
        answer: 'Tyre balancing involves adjusting the distribution of weight around a tyre to ensure even wear and smooth driving. Proper balancing prevents vibrations enhances handling and extends the lifespan of both tyres and suspension components.',
      },
      {
        question: 'How often should I rotate my tyres',
        answer: 'Tyres should be rotated every 6 months or every 10000 kilometers to ensure even wear and extend their lifespan. The rotation pattern depends on your vehicles drive type and tyre wear patterns.',
      },
      {
        question: 'What is wheel alignment and how can it affect my vehicle',
        answer: 'Wheel alignment ensures that your vehicles wheels are set to the manufacturer specifications. Proper alignment improves handling reduces tyre wear and enhances fuel efficiency. Misalignment can cause your vehicle to pull to one side and lead to uneven tyre wear.',
      },
      {
        question: 'How do I check if my tyres are properly inflated',
        answer: 'You can check your tyre pressure using a tyre pressure gauge. Ensure that the pressure matches the recommended levels specified in your vehicles manual or the sticker inside the drivers side door frame. Check pressure when tyres are cold for accurate readings.',
      },
      {
        question: 'Can I drive with a flat tyre',
        answer: 'Driving on a flat tyre is dangerous and can cause further damage to the tyre and wheel. If you experience a flat tyre pull over safely and contact us for assistance. Avoid driving until the tyre is repaired or replaced.',
      },
      {
        question: 'How can I extend the life of my tyres',
        answer: 'To extend your tyres lifespan ensure regular tyre rotations maintain proper tyre pressure avoid aggressive driving and have regular wheel alignments. Proper care and maintenance can help prevent premature wear and damage.',
      },
      {
        question: 'What should I do if I notice uneven tyre wear',
        answer: 'Uneven tyre wear may indicate issues such as incorrect wheel alignment unbalanced tyres or suspension problems. Have your tyres inspected by a professional to diagnose the cause and make necessary adjustments or repairs.',
      },
      {
        question: 'How do I know if my tyres need balancing',
        answer: 'Signs that your tyres may need balancing include vibrations in the steering wheel seat or floorboard while driving. If you notice these symptoms it is a good idea to have your tyres balanced to improve driving comfort and prevent uneven wear.',
      },
      {
        question: 'What are the benefits of using highquality tyres',
        answer: 'Highquality tyres offer better traction durability and performance compared to cheaper alternatives. They enhance safety fuel efficiency and driving comfort and typically have better resistance to wear and damage.',
      },
    ],
  },
  {
    title: 'Car Denting & Painting',
    items: [
      {
        question: 'How can I book a denting and painting service with My FNG',
        answer: 'You can book a denting and painting service by visiting our website www.myfng.in or calling us at +919167779696. Our team will assist you with scheduling and provide all necessary details.',
      },
      {
        question: 'What does the Front Bumper Paint service include',
        answer: 'The Front Bumper Paint service involves removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What is included in the Right Fender Paint service',
        answer: 'The Right Fender Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What does the Left Fender Paint service cover',
        answer: 'The Left Fender Paint service covers removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What is included in the Bonnet Paint service',
        answer: 'The Bonnet Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What does the Right Front Door Paint service involve',
        answer: 'The Right Front Door Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What is covered in the Right Rear Door Paint service',
        answer: 'The Right Rear Door Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What does the Left Front Door Paint service include',
        answer: 'The Left Front Door Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What is included in the Left Rear Door Paint service',
        answer: 'The Left Rear Door Paint service includes removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'What does the Right Quarter Panel Paint service involve',
        answer: 'The Right Quarter Panel Paint service involves removing all minor dents removing all ancillary parts from the panel applying highquality primer paint and clear coat rubbing and polishing the painted panel refitting all ancillary parts and conducting a quality check by an experienced quality controller. Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.',
      },
      {
        question: 'How do I know if my car needs denting and painting services',
        answer: 'If your car has visible dents scratches or paint damage it may benefit from denting and painting services. Common signs include paint chipping deep scratches or noticeable dents. Regular inspections can help identify issues early.',
      },
      {
        question: 'Can you fix rusted panels',
        answer: 'Our denting and painting services do not cover rusted panels. Rust repair requires specialized treatment and additional services. We recommend addressing rust issues before proceeding with denting and painting.',
      },
      {
        question: 'How long does a denting and painting service take',
        answer: 'The duration of denting and painting services varies depending on the extent of the damage. On average it may take between 2 to 5 days. We will provide a more accurate timeline during your service booking.',
      },
      {
        question: 'Will I receive a warranty for the denting and painting work',
        answer: 'Yes we offer a warranty on our denting and painting services to ensure customer satisfaction. The warranty covers workmanship and paint quality. Specific terms and conditions apply which will be discussed at the time of service.',
      },
    ],
  },
  {
    title: 'Car Detailing',
    items: [
      {
        question: 'How can I contact you for more questions about car detailing',
        answer: 'For additional questions or more information reach out via our website www.myfng.in or call us at +919167779696. Our customer support team is here to help.',
      },
      {
        question: 'What is included in your 3M Wax Polish service',
        answer: 'Our 3M Wax Polish service enhances your vehicles shine and provides additional protection. It includes machinebased wax polish: Application of highquality 3M wax polish using advanced machinery. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What does the 3M Interior detailing service include',
        answer: 'Our 3M Interior service uses premium 3M products to clean and protect your vehicles interior. The service includes shampooing: Cleaning carpets seats and roof scrubbing and polishing: Door trims and dashboard. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What does the 3M Exterior detailing service involve',
        answer: 'Our 3M Exterior detailing service focuses on cleaning and protecting the vehicles surface using 3M products. It includes painted surfaces: Sanding machinebased rubbing washing machinebased glazing UV protection. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What is Nano Ceramic Coating Single Layer service',
        answer: 'The Nano Ceramic Coating Single Layer service provides longlasting protection and enhanced shine for your vehicles painted surfaces. It includes painted surfaces: Sanding machinebased rubbing washing machinebased glazing UV protection ceramic coat application. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What does the Nano Ceramic Coating Double Layer service cover',
        answer: 'The Nano Ceramic Coating Double Layer service offers superior protection and durability with a double layer of ceramic coating. It includes painted surfaces: Sanding machinebased rubbing washing machinebased glazing UV protection application of 2 ceramic coats. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What is included in the Antirust Under Body Coating service',
        answer: 'The Antirust Under Body Coating service protects your vehicles underbody from rust and corrosion. It includes washing and drying: Thorough cleaning of the underbody machinebased antirust application: Application of antirust coating. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What does the Silencer Coating service entail',
        answer: 'Our Silencer Coating service prevents rust and enhances the durability of your vehicles silencer. It includes washing and drying: Cleaning of the silencer spraying of antirust application: Application of antirust coating. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'What is the Paint Protection Film PPF service',
        answer: 'The Paint Protection Film PPF service involves applying a protective film to safeguard your vehicles paint from scratches chips and other damage. Note: This includes only labor charges parts will be billed at actual cost.',
      },
      {
        question: 'How long does each detailing service take',
        answer: 'The duration varies depending on the service selected and the vehicles condition. On average detailing services can take from 4 to 8 hours. We will provide an estimated time when you book your service.',
      },
      {
        question: 'How often should I get my car detailed',
        answer: 'We recommend detailing your car every 6 months to maintain its appearance and protect its value. Frequency can vary based on usage and personal preference.',
      },
      {
        question: 'Do I need to make an appointment for detailing services',
        answer: 'Yes appointments are necessary. You can schedule a detailing service online at www.myfng.in or by calling us at +919167779696.',
      },
      {
        question: 'Can detailing remove deep scratches or damage',
        answer: 'Our detailing services including paint correction can address some deep scratches and damage. The extent of removal depends on the severity of the damage.',
      },
      {
        question: 'Are the products used safe for my vehicle',
        answer: 'Yes we use highquality industryapproved products that are safe for your vehicles paint and surfaces. Our products are chosen to ensure effective cleaning and protection without causing harm.',
      },
    ],
  },
  {
    title: 'Clutch Service',
    items: [
      {
        question: 'How can I contact you for more information about the Clutch Maintenance Package',
        answer: 'For more information or to discuss your Clutch Maintenance Package contact us via our website www.myfng.in or call us at +919167779696. Our customer support team is here to help.',
      },
      {
        question: 'What is included in the Clutch Maintenance Package',
        answer:
          'Our Clutch Maintenance Package includes a comprehensive service to ensure optimal clutch performance. The package covers: Disconnecting Gearbox from Engine: Removing the gearbox for inspection and maintenance Replacement of Clutch Plate: Installing a new clutch plate if required Pressure Plate: Replacing the pressure plate to ensure proper engagement Clutch Release Bearing: Replacing the release bearing to facilitate smooth operation Flywheel and Flywheel Bearing: Replacing these components if necessary Clutch Cable or Cylinders: Replacing the clutch cable or hydraulic cylinders if needed Refitting Gearbox: Reinstalling the gearbox to the engine Replacement of Gear Oil: Changing the gear oil to ensure proper lubrication.',
      },
      {
        question: 'Why is a Clutch Maintenance Package important',
        answer: 'The Clutch Maintenance Package is essential for maintaining your vehicles clutch system in top condition. It helps prevent clutch failure ensures smooth gear shifts and extends the lifespan of your clutch components.',
      },
      {
        question: 'How often should I consider a Clutch Maintenance Package',
        answer: 'It is advisable to consider a Clutch Maintenance Package during regular service intervals or if you experience any symptoms of clutch issues. Typically this service is recommended every 20000 to 30000 kilometers or every 2 years.',
      },
      {
        question: 'What are the signs that I need a Clutch Maintenance Package',
        answer: 'Signs that you may need a Clutch Maintenance Package include: Slipping Clutch: The clutch fails to fully engage causing a loss of power Difficulty Shifting Gears: Hard to shift gears or the clutch pedal feels stiff Unusual Noises: Grinding or squeaking noises when engaging the clutch Clutch Pedal Issues: Soft or spongy pedal or excessive play.',
      },
      {
        question: 'How long does the Clutch Maintenance Package service take',
        answer: 'The duration of the Clutch Maintenance Package service can vary depending on your vehicle condition and the extent of the work required. On average this service takes between 6 to 8 hours. We will provide an estimated time frame during the booking process.',
      },
      {
        question: 'Will you use genuine parts for the Clutch Maintenance Package',
        answer: 'Yes we use highquality manufacturerapproved parts for all our clutch services. This ensures optimal performance and reliability of your vehicles clutch system.',
      },
      {
        question: 'Are there any additional costs for the Clutch Maintenance Package',
        answer: 'The Clutch Maintenance Package covers labor charges only. Any additional parts required will be billed at actual cost. We will provide a detailed estimate before commencing the service.',
      },
      {
        question: 'What should I do if I experience issues with my clutch after the service',
        answer: 'If you experience any issues with your clutch after the service contact us immediately. We will diagnose and address any problems to ensure your clutch operates correctly.',
      },
      {
        question: 'Can the Clutch Maintenance Package be customized',
        answer: 'Yes the Clutch Maintenance Package can be customized based on your vehicle specific needs and your preferences. Please let us know your requirements and we will tailor the package accordingly.',
      },
      {
        question: 'What happens if additional repairs are needed during the service',
        answer: 'If additional repairs are identified during the service we will inform you and provide a detailed estimate before proceeding. Additional parts and repairs will be billed at actual cost.',
      },
      {
        question: 'How can I book the Clutch Maintenance Package',
        answer: 'You can book the Clutch Maintenance Package online through our website www.myfng.in or by calling us at +919167779696. Our team will assist you with scheduling and provide all necessary details.',
      },
      {
        question: 'Is there a warranty for the Clutch Maintenance Package',
        answer: 'Yes we offer a warranty on the labor involved in the Clutch Maintenance Package. The warranty details will be provided at the time of service and parts come with their own manufacturer warranties.',
      },
      {
        question: 'How do I know if the Clutch Maintenance Package is right for my vehicle',
        answer: 'If you are experiencing clutch issues or it is time for a regular service interval the Clutch Maintenance Package is an excellent choice. Our team can assess your vehicle condition and recommend the appropriate service.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-20 sm:pt-24">
        <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
              <div className="text-sm font-bold text-brand-primary">MY FNG</div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">FAQ</h1>
              <p className="mt-4 text-base sm:text-lg text-gray-700">
                Answers to the most common questions about My FNG services, bookings, pricing, and warranties.
              </p>
            </div>

            <div className="mt-8 space-y-8">
              {FAQ_SECTIONS.map((section) => (
                <section key={section.title} className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{section.title}</h2>
                  <div className="mt-6 space-y-4">
                    {section.items.map((item) => (
                      <div key={item.question} className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{item.question}</h3>
                        <p className="mt-2 text-sm sm:text-base text-gray-700">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
