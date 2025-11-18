#!/bin/bash

echo "📱 Building MyFNG Mobile App Structure..."
echo ""

cd /Users/roadserve/Downloads/MyFNG/apps/mobile || exit 1

# Create all dashboard directories
echo "📁 Creating dashboard folders..."
mkdir -p src/screens/dashboard/super_admin
mkdir -p src/screens/dashboard/workshop_admin
mkdir -p src/screens/dashboard/workshop_supervisor
mkdir -p src/screens/dashboard/workshop_mechanic
mkdir -p src/screens/dashboard/workshop_pickup_boy
mkdir -p src/screens/dashboard/lead_manager
mkdir -p src/screens/dashboard/customer

# Create components directory
mkdir -p src/components/dashboard

echo "✅ Folders created!"
echo ""
echo "📋 Structure:"
echo "src/screens/dashboard/"
echo "  ├── super_admin/"
echo "  ├── workshop_admin/"
echo "  ├── workshop_supervisor/"
echo "  ├── workshop_mechanic/"
echo "  ├── workshop_pickup_boy/"
echo "  ├── lead_manager/"
echo "  └── customer/"
echo ""

