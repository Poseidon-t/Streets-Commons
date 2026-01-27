"""
Quick test script for local CV backend
Run this to verify the API works before deploying
"""

import requests
import json

# API endpoint
BASE_URL = "http://localhost:8000"

# Test Mapillary image URL (example)
TEST_IMAGE_URL = "https://images.mapillary.com/Z2V-SQzj3pA6qX0j3VXq8Q/thumb-1024.jpg"
TEST_IMAGE_ID = "test_image_123"


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Health check passed")
        print(f"   Status: {data['status']}")
        print(f"   Model loaded: {data['model_loaded']}")
        print(f"   Device: {data['device']}")
        print(f"   GPU available: {data['gpu_available']}")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        return False


def test_analyze():
    """Test single image analysis"""
    print("\nTesting image analysis endpoint...")

    payload = {
        "image_url": TEST_IMAGE_URL,
        "image_id": TEST_IMAGE_ID
    }

    try:
        response = requests.post(
            f"{BASE_URL}/analyze",
            json=payload,
            timeout=60  # Analysis can take 30-60s on first run
        )

        if response.status_code == 200:
            data = response.json()
            print(f"✅ Analysis successful")
            print(f"   Image ID: {data['imageId']}")
            print(f"   Sidewalk detected: {data['sidewalkDetected']}")
            print(f"   Confidence: {data['confidence']}")
            print(f"   Quality: {data['quality']}")
            print(f"   Issues: {', '.join(data['issues']) if data['issues'] else 'None'}")
            print(f"   Notes: {data['notes']}")

            if data.get('detections'):
                print(f"   Detections:")
                for det in data['detections'][:5]:  # Show first 5
                    print(f"     - {det['class_name']}: {det['pixel_percentage']:.1f}% of image")

            return True
        else:
            print(f"❌ Analysis failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False

    except requests.exceptions.Timeout:
        print("⚠️  Analysis timed out (this can happen on first run)")
        print("   Try again - model is loading...")
        return False
    except Exception as e:
        print(f"❌ Analysis error: {e}")
        return False


def test_root():
    """Test root endpoint"""
    print("\nTesting root endpoint...")
    response = requests.get(f"{BASE_URL}/")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Root endpoint OK")
        print(f"   Service: {data['service']}")
        print(f"   Model: {data['model']}")
        return True
    else:
        print(f"❌ Root endpoint failed: {response.status_code}")
        return False


def main():
    print("=" * 60)
    print("SafeStreets CV Backend - Local Test")
    print("=" * 60)
    print(f"\nTesting API at: {BASE_URL}")
    print("\n⚠️  Make sure backend is running:")
    print("   cd cv-backend")
    print("   python main.py")
    print("=" * 60)

    # Run tests
    tests_passed = 0
    tests_total = 3

    if test_root():
        tests_passed += 1

    if test_health():
        tests_passed += 1

    if test_analyze():
        tests_passed += 1

    # Summary
    print("\n" + "=" * 60)
    print(f"Tests passed: {tests_passed}/{tests_total}")

    if tests_passed == tests_total:
        print("✅ All tests passed! Backend is working correctly.")
        print("\nNext steps:")
        print("1. Deploy to Railway/Fly.io")
        print("2. Update VITE_CV_API_URL in .env")
        print("3. Test with frontend")
    else:
        print("❌ Some tests failed. Check the errors above.")
        print("\nTroubleshooting:")
        print("1. Make sure backend is running: python main.py")
        print("2. Check port 8000 is not in use")
        print("3. Verify Python dependencies installed")
        print("4. Check logs for model loading errors")

    print("=" * 60)


if __name__ == "__main__":
    main()
