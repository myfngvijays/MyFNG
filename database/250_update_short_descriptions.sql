DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('MY FNG - Multi-Brand Car Servicing and Repairs Across India', 'India'),
      ('My FNG - Multi Brand Car Garage & Repairs at Vartak Nagar, Thane West', 'Vartak Nagar, Thane West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Manpada, Thane West', 'Manpada, Thane West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Majiwada, Thane West', 'Majiwada, Thane West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kasarvadavali, Thane West', 'Kasarvadavali, Thane West'),
      ('My FNG - Multi Brand Car Garage & Repairs at GB Road, Thane West', 'GB Road, Thane West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kalyan-Shilphata Marg, Dombivli East', 'Kalyan-Shilphata Marg, Dombivli East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kolegaon, Dombivli East', 'Kolegaon, Dombivli East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Malang Gad Road, Kalyan East', 'Malang Gad Road, Kalyan East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Chikanghar, Kalyan West', 'Chikanghar, Kalyan West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ambernath-Badlapur Rd, Ambernath', 'Ambernath-Badlapur Rd, Ambernath'),
      ('My FNG - Multi Brand Car Garage & Repairs at Neral-Badlapur Rd, Badlapur', 'Neral-Badlapur Rd, Badlapur'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kalyan-Sape Rd, Bhiwandi', 'Kalyan-Sape Rd, Bhiwandi'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ghotsai Rd, Titwala', 'Ghotsai Rd, Titwala'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ramdev Park Rd, Mira Road East', 'Ramdev Park Rd, Mira Road East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Miragaon Rd, Mira Road East', 'Miragaon Rd, Mira Road East'),
      ('My FNG - Multi Brand Car Garage & Repairs at S Central Road, Shiravane, Nerul', 'S Central Road, Shiravane, Nerul'),
      ('My FNG - Multi Brand Car Garage & Repairs at Shiravane, Nerul', 'Shiravane, Nerul'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pawne, Koparkhairane', 'Pawne, Koparkhairane'),
      ('My FNG - Multi Brand Car Garage & Repairs at Bangli Road, Vasai West', 'Bangli Road, Vasai West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Waliv Road, Vasai East', 'Waliv Road, Vasai East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Bolinj-Sopara Rd, Virar West', 'Bolinj-Sopara Rd, Virar West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Boisar-Tarapur Rd, Boisar', 'Boisar-Tarapur Rd, Boisar'),
      ('My FNG - Multi Brand Car Garage & Repairs in Palghar', 'Palghar'),
      ('My FNG - Multi Brand Car Garage & Repairs at Saki Vihar Rd, Andheri East', 'Saki Vihar Rd, Andheri East'),
      ('My FNG - Multi Brand Car Garage & Repairs at Jankalyan Nagar, Malad West', 'Jankalyan Nagar, Malad West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Moti Nagar, Mulund West', 'Moti Nagar, Mulund West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ambedkar Nagar, Dadar West', 'Ambedkar Nagar, Dadar West'),
      ('My FNG - Multi Brand Car Garage & Repairs at SV Rd, Vile Parle West', 'SV Rd, Vile Parle West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Dr. EM Rd, Mahalaxmi', 'Dr. EM Rd, Mahalaxmi'),
      ('My FNG - Multi Brand Car Garage & Repairs at Milind Nagar, Ghatkopar West', 'Milind Nagar, Ghatkopar West'),
      ('My FNG - Multi Brand Car Garage & Repairs at HOC Colony, Panvel', 'HOC Colony, Panvel'),
      ('My FNG - Multi Brand Car Garage & Repairs at Shivaji Nagar, Panvel', 'Shivaji Nagar, Panvel'),
      ('My FNG - Multi Brand Car Garage & Repairs at Steel Market Rd, Kalamboli', 'Steel Market Rd, Kalamboli'),
      ('My FNG - Multi Brand Car Garage & Repairs at Yashwant Nagar, Khopoli', 'Yashwant Nagar, Khopoli'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kandarpada, Dahisar West', 'Kandarpada, Dahisar West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Charkop, Kandivali West', 'Charkop, Kandivali West'),
      ('My FNG - Multi Brand Car Garage & Repairs at New Link Rd, Borivali West', 'New Link Rd, Borivali West'),
      ('My FNG - Multi Brand Car Garage & Repairs at Mahul, Chembur', 'Mahul, Chembur'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ashoka Nagar, Kharadi, Pune', 'Ashoka Nagar, Kharadi, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ganesh Temple, Saswad, Pune', 'Ganesh Temple, Saswad, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kate Petrol Pump, Pimple Saudagar, Pimpri-Chinchwad, Pune', 'Kate Petrol Pump, Pimple Saudagar, Pimpri-Chinchwad, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pashan Link Rd, Baner, Pune', 'Pashan Link Rd, Baner, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ahilyanagar Highway, Wagholi, Pune', 'Ahilyanagar Highway, Wagholi, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Santoshi Mata Rd, Katraj, Pune', 'Santoshi Mata Rd, Katraj, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Sakore Nagar, Vimanagar, Pune', 'Sakore Nagar, Vimanagar, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Hinjawadi Aundh Rd, Wakad, Pune', 'Hinjawadi Aundh Rd, Wakad, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Dattawadi, Tathawade, Pune', 'Dattawadi, Tathawade, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Park Town Rd, Hadapsar, Pune', 'Park Town Rd, Hadapsar, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Anand Nagar, Suncity, Pune', 'Anand Nagar, Suncity, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Lohgaon-Wagholi Rd, Baner, Pune', 'Lohgaon-Wagholi Rd, Baner, Pune'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pathardi Phata, Nashik', 'Pathardi Phata, Nashik')
    ) AS t(business_name, area)
  LOOP
    UPDATE public.workshop_public_pages
    SET short_description = 'Premier auto service center in ' || rec.area || ' offering comprehensive car maintenance, repair, and detailing services with expert technicians.'
    WHERE gmb_data->>'business_name' = rec.business_name;
  END LOOP;
END $$;
