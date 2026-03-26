import requests
import urllib.parse
from fastapi import HTTPException
from dotenv import load_dotenv
import os

def get_auth_params():
    return {
        "app_id": os.getenv("ALIMENT_API_ID"),
        "app_key": os.getenv("ALIMENT_API_KEY")
    }

def search_food(food_name):
    params = get_auth_params()
    params["ingr"] = food_name
    params["nutrition-type"] = "logging"
    ALIMENT_API_URL = os.getenv("ALIMENT_API_URL")
    full_url = f"{ALIMENT_API_URL}?{urllib.parse.urlencode(params)}"
    
    try:
        response = requests.get(full_url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            results = []

            for item in data.get("parsed", []):
                food = item.get("food", {})
                image_url = food.get("image")
                
                if image_url:
                    results.append({
                        "code": food.get("foodId"),
                        "name": food.get("label"),
                        "image": image_url,
                        "type": "GENERIC"
                    })

            for item in data.get("hints", [])[:15]: 
                food = item.get("food", {})
                image_url = food.get("image")
                
                if image_url:
                    results.append({
                        "code": food.get("foodId"),
                        "name": food.get("label"),
                        "image": image_url,
                        "type": "BRANDED"
                    })
            
            return results
    
    except Exception as e:
        print(f"Erreur API Edamam: {e}")
        return []

    return []

def get_food_by_code(code, quantity):
    quantity = float(quantity)
    url = "https://api.edamam.com/api/food-database/v2/nutrients"
    params = get_auth_params()

    payload = {
        "ingredients": [
            {
                "quantity": quantity,
                "measureURI": "http://www.edamam.com/ontologies/edamam.owl#Measure_gram",
                "foodId": code
            }
        ]
    }

    try:
        response = requests.post(url, params=params, json=payload, timeout=5)

        if response.status_code == 200:
            data = response.json()
            
            if data.get("ingredients") and len(data["ingredients"]) > 0:
                parsed = data["ingredients"][0].get("parsed")
                if parsed and len(parsed) > 0:
                    food_name = parsed[0].get("foodMatch", "Aliment Inconnu")

            if data.get("totalNutrients"):
                nutrients = data.get("totalNutrients", {})
                
                def nq(key):
                    return nutrients.get(key, {}).get("quantity") or 0

                sodium_mg = nq("NA")
                salt_g = (sodium_mg * 2.5) / 1000

                return {
                    "energy": round(nq("ENERC_KCAL"), 1),
                    "proteins": round(nq("PROCNT"), 1),
                    "carbohydrates": round(nq("CHOCDF"), 1),
                    "sugars": round(nq("SUGAR"), 1),
                    "lipids": round(nq("FAT"), 1),
                    "saturated_fats": round(nq("FASAT"), 1),
                    "fiber": round(nq("FIBTG"), 1),
                    "salt": round(salt_g, 2)
                }
            else:
                 return None
        else:
            print(f"Erreur HTTP {response.status_code}")
            return None

    except Exception as e:
        print(f"Erreur technique: {e}")
        return None

def get_muscles():
    EXERCICES_API_URL = os.getenv("EXERCICES_API_URL")
    FULL_URL = f"{EXERCICES_API_URL}/muscles"
    response = requests.get(FULL_URL)

    if response.status_code == 200:
        try:
            data = response.json()
            return data
        except ValueError:
            print("Erreur de décodage JSON pour l'URL :", FULL_URL)
            return None
    elif response.status_code == 404:
        raise HTTPException(status_code=404, detail="Ressource non trouvée")
    return [];
    
def get_exercises(muscle):
    EXERCICES_API_URL = os.getenv("EXERCICES_API_URL")
    FULL_URL = f"{EXERCICES_API_URL}/muscles/{muscle}/exercises"
    response = requests.get(FULL_URL)

    if response.status_code == 200:
        try:
            data = response.json()
            return data
        except ValueError:
            print("Erreur de décodage JSON pour l'URL :", FULL_URL)
            return None
    elif response.status_code == 404:
        raise HTTPException(status_code=404, detail="Muscle not found")
    return [];

def scan_food(code, format):
    SCAN_API = os.getenv("SCAN_API")
    FULL_URL = f"{SCAN_API}/api/v0/product/{code}.{format}"
    response = requests.get(FULL_URL)

    if response.status_code == 200:
        try:
            data = response.json()
            product = data.get("product")
            nutriments = product.get("nutriments", {})

            return {
                "name": product.get("product_name", "Unknown"),
                "energy": nutriments.get("energy-kcal_100g") or 0,
                "proteins": nutriments.get("proteins_100g") or 0,
                "carbohydrates": nutriments.get("carbohydrates_100g") or 0,
                "sugars": nutriments.get("sugars_100g") or 0,
                "lipids": nutriments.get("fat_100g") or 0,
                "saturated_fats": nutriments.get("saturated-fat_100g") or 0,
                "fiber": nutriments.get("fiber_100g") or 0,
                "salt": nutriments.get("salt_100g") or 0
            }
        except ValueError:
            print("Erreur de décodage pour l'URL :", FULL_URL)
            return None
    elif response.status_code == 404:
        raise HTTPException(status_code=404, detail="Aliment not found")
    return None
