-- Car loan smart tool: open embed form only in mobile WebView (no site chrome)
UPDATE public.smart_tools
SET default_web_url = 'https://myfng.in/car-loan?embed=1'
WHERE tool_id = 'car_loan'
  AND (default_web_url IS NULL OR default_web_url NOT LIKE '%embed=1%');
