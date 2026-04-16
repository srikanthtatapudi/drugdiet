import pandas as pd
import numpy as np
import kaggle
import sqlite3
from sqlalchemy import create_engine
import os
import requests
import json
from typing import List, Dict
import warnings
warnings.filterwarnings('ignore')

class MedicalDataLoader:
    def __init__(self, db_path: str = "medical_system.db"):
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}")
        self.kaggle_api_authenticated = False
        
    def authenticate_kaggle(self):
        """Authenticate with Kaggle API"""
        try:
            # Set up Kaggle API credentials
            kaggle.api.authenticate()
            self.kaggle_api_authenticated = True
            print("Kaggle API authenticated successfully")
        except Exception as e:
            print(f"Kaggle authentication failed: {e}")
            self.kaggle_api_authenticated = False
    
    def download_drug_reviews_dataset(self):
        """Download drug reviews dataset from Kaggle"""
        if not self.kaggle_api_authenticated:
            print("Kaggle not authenticated, skipping drug reviews dataset")
            return None
        
        try:
            # Download Drug Reviews dataset
            print("Downloading Drug Reviews dataset...")
            kaggle.api.dataset_download_files(
                'jessicali9530/kuc-hackathon-winter-2018',
                path='data/drug_reviews',
                unzip=True
            )
            
            # Load the data
            df_train = pd.read_csv('data/drug_reviews/drugsComTrain_raw.csv')
            df_test = pd.read_csv('data/drug_reviews/drugsComTest_raw.csv')
            
            # Combine train and test
            df_drugs = pd.concat([df_train, df_test], ignore_index=True)
            
            print(f"Loaded {len(df_drugs)} drug reviews")
            return df_drugs
            
        except Exception as e:
            print(f"Error downloading drug reviews: {e}")
            return None
    
    def download_medical_qa_dataset(self):
        """Download medical Q&A dataset"""
        if not self.kaggle_api_authenticated:
            print("Kaggle not authenticated, skipping medical Q&A dataset")
            return None
        
        try:
            # Download Medical Q&A dataset
            print("Downloading Medical Q&A dataset...")
            kaggle.api.dataset_download_files(
                'rohitsharma/healthcare-qa',
                path='data/medical_qa',
                unzip=True
            )
            
            # Try to load the data
            if os.path.exists('data/medical_qa/Healthcare_QA.csv'):
                df_qa = pd.read_csv('data/medical_qa/Healthcare_QA.csv')
                print(f"Loaded {len(df_qa)} medical Q&A pairs")
                return df_qa
            else:
                print("Medical Q&A file not found")
                return None
                
        except Exception as e:
            print(f"Error downloading medical Q&A: {e}")
            return None
    
    def download_nutrition_dataset(self):
        """Download nutrition dataset"""
        if not self.kaggle_api_authenticated:
            print("Kaggle not authenticated, skipping nutrition dataset")
            return None
        
        try:
            # Download Nutrition dataset
            print("Downloading Nutrition dataset...")
            kaggle.api.dataset_download_files(
                'niyamarora/nutrition-dataset-for-recipe-recommendation',
                path='data/nutrition',
                unzip=True
            )
            
            # Try to load the data
            if os.path.exists('data/nutrition/nutrition.csv'):
                df_nutrition = pd.read_csv('data/nutrition/nutrition.csv')
                print(f"Loaded {len(df_nutrition)} nutrition items")
                return df_nutrition
            else:
                print("Nutrition file not found")
                return None
                
        except Exception as e:
            print(f"Error downloading nutrition dataset: {e}")
            return None
    
    def download_drug_interactions_dataset(self):
        """Download drug interactions dataset"""
        if not self.kaggle_api_authenticated:
            print("Kaggle not authenticated, creating sample drug interactions")
            return self.create_sample_drug_interactions()
        
        try:
            # Download Drug Interactions dataset
            print("Downloading Drug Interactions dataset...")
            kaggle.api.dataset_download_files(
                'furiousmeta12/drug-interactions',
                path='data/drug_interactions',
                unzip=True
            )
            
            # Try to load the data
            if os.path.exists('data/drug_interactions/drug_interactions.csv'):
                df_interactions = pd.read_csv('data/drug_interactions/drug_interactions.csv')
                print(f"Loaded {len(df_interactions)} drug interactions")
                return df_interactions
            else:
                print("Drug interactions file not found, creating sample data")
                return self.create_sample_drug_interactions()
                
        except Exception as e:
            print(f"Error downloading drug interactions: {e}")
            return self.create_sample_drug_interactions()
    
    def create_sample_drug_interactions(self):
        """Create sample drug interactions data"""
        interactions = []
        
        # Sample drug interactions
        sample_interactions = [
            (1, "Aspirin", "Warfarin", "high", "Increased risk of bleeding"),
            (2, "Lisinopril", "Potassium supplements", "medium", "Hyperkalemia risk"),
            (3, "Metformin", "Iodinated contrast", "high", "Lactic acidosis risk"),
            (4, "Simvastatin", "Grapefruit juice", "medium", "Increased statin levels"),
            (5, "Amoxicillin", "Alcohol", "low", "Minor stomach upset"),
            (6, "Ibuprofen", "Lithium", "high", "Lithium toxicity risk"),
            (7, "Prednisone", "NSAIDs", "high", "GI bleeding risk"),
            (8, "Digoxin", "Diuretics", "medium", "Electrolyte imbalance"),
            (9, "Beta blockers", "Insulin", "medium", "Masked hypoglycemia"),
            (10, "Antihistamines", "Alcohol", "medium", "Increased drowsiness")
        ]
        
        for id_val, drug1, drug2, severity, description in sample_interactions:
            interactions.append({
                'id': id_val,
                'drug1': drug1,
                'drug2': drug2,
                'severity': severity,
                'description': description
            })
        
        return pd.DataFrame(interactions)
    
    def process_drug_data(self, df_drugs: pd.DataFrame):
        """Process drug reviews data and create drug database"""
        if df_drugs is None or df_drugs.empty:
            print("No drug data to process")
            return None
        
        try:
            # Clean and process drug data
            df_drugs = df_drugs.dropna(subset=['drugName', 'condition'])
            
            # Aggregate by drug name
            drug_stats = df_drugs.groupby('drugName').agg({
                'rating': ['mean', 'count'],
                'review': lambda x: ' '.join(x.astype(str)),
                'condition': lambda x: x.mode().iloc[0] if not x.mode().empty else 'Unknown'
            }).reset_index()
            
            # Flatten column names
            drug_stats.columns = ['name', 'avg_rating', 'reviews_count', 'reviews', 'common_condition']
            
            # Create drug categories based on common conditions
            def categorize_drug(condition):
                condition = str(condition).lower()
                if any(word in condition for word in ['pain', 'headache', 'migraine']):
                    return 'Pain Relief'
                elif any(word in condition for word in ['depression', 'anxiety', 'bipolar']):
                    return 'Mental Health'
                elif any(word in condition for word in ['blood pressure', 'hypertension']):
                    return 'Cardiovascular'
                elif any(word in condition for word in ['diabetes', 'blood sugar']):
                    return 'Diabetes'
                elif any(word in condition for word in ['infection', 'bacterial']):
                    return 'Antibiotics'
                elif any(word in condition for word in ['cholesterol', 'lipid']):
                    return 'Cholesterol'
                else:
                    return 'Other'
            
            drug_stats['category'] = drug_stats['common_condition'].apply(categorize_drug)
            
            # Add additional drug information
            drug_stats['description'] = drug_stats['reviews'].apply(lambda x: x[:200] + '...' if len(x) > 200 else x)
            drug_stats['side_effects'] = 'Common side effects may include nausea, dizziness, headache'
            drug_stats['contraindications'] = 'Consult doctor if pregnant, breastfeeding, or have other medical conditions'
            drug_stats['dosage'] = 'Dosage varies by condition and patient. Follow doctor\'s instructions.'
            
            # Select and rename columns to match database schema
            final_drugs = drug_stats[[
                'name', 'description', 'category', 'side_effects', 
                'contraindications', 'dosage', 'avg_rating', 'reviews_count'
            ]].rename(columns={
                'name': 'name',
                'avg_rating': 'rating',
                'reviews_count': 'reviews_count'
            })
            
            # Add id column
            final_drugs.insert(0, 'id', range(1, len(final_drugs) + 1))
            
            print(f"Processed {len(final_drugs)} unique drugs")
            return final_drugs
            
        except Exception as e:
            print(f"Error processing drug data: {e}")
            return None
    
    def process_nutrition_data(self, df_nutrition: pd.DataFrame):
        """Process nutrition data for diet recommendations"""
        if df_nutrition is None or df_nutrition.empty:
            print("No nutrition data to process")
            return self.create_sample_nutrition_data()
        
        try:
            # Clean and process nutrition data
            processed_foods = []
            
            for food in df_nutrition.to_dict('records'):
                food_item = {
                    'id': len(processed_foods) + 1,
                    'name': food['name'],
                    'category': food['category'],
                    'calories_per_100g': food['calories_per_100g'],
                    'protein': food['protein'],
                    'carbs': food['carbs'],
                    'fat': food['fat'],
                    'fiber': food['fiber'],
                    'vitamins': food['vitamins'],
                    'minerals': food['minerals'],
                    'suitable_for_conditions': food['suitable_for_conditions']
                }
                processed_foods.append(food_item)
            
            return pd.DataFrame(processed_foods)
            
        except Exception as e:
            print(f"Error processing nutrition data: {e}")
            return self.create_sample_nutrition_data()
    
    def create_sample_nutrition_data(self):
        """Create sample nutrition data"""
        foods = [
            {
                'id': 1,
                'name': 'Chicken Breast',
                'category': 'Protein',
                'calories_per_100g': 165,
                'protein': 31,
                'carbs': 0,
                'fat': 3.6,
                'fiber': 0,
                'vitamins': 'B6, Niacin, B12',
                'minerals': 'Phosphorus, Selenium',
                'suitable_for_conditions': 'Diabetes, Weight Management'
            },
            {
                'id': 2,
                'name': 'Brown Rice',
                'category': 'Grains',
                'calories_per_100g': 111,
                'protein': 2.6,
                'carbs': 23,
                'fat': 0.9,
                'fiber': 1.8,
                'vitamins': 'B1, B6',
                'minerals': 'Manganese, Magnesium',
                'suitable_for_conditions': 'Diabetes, Heart Health'
            },
            {
                'id': 3,
                'name': 'Broccoli',
                'category': 'Vegetables',
                'calories_per_100g': 34,
                'protein': 2.8,
                'carbs': 7,
                'fat': 0.4,
                'fiber': 2.6,
                'vitamins': 'C, K, Folate',
                'minerals': 'Potassium, Iron',
                'suitable_for_conditions': 'Diabetes, Heart Health, Weight Management'
            },
            {
                'id': 4,
                'name': 'Salmon',
                'category': 'Protein',
                'calories_per_100g': 208,
                'protein': 20,
                'carbs': 0,
                'fat': 13,
                'fiber': 0,
                'vitamins': 'D, B12, B6',
                'minerals': 'Selenium, Potassium',
                'suitable_for_conditions': 'Heart Health, Brain Health'
            },
            {
                'id': 5,
                'name': 'Quinoa',
                'category': 'Grains',
                'calories_per_100g': 120,
                'protein': 4.4,
                'carbs': 21,
                'fat': 1.9,
                'fiber': 2.8,
                'vitamins': 'B1, B2, B6',
                'minerals': 'Manganese, Magnesium, Iron',
                'suitable_for_conditions': 'Diabetes, Weight Management'
            },
            {
                'id': 6,
                'name': 'Greek Yogurt',
                'category': 'Dairy',
                'calories_per_100g': 59,
                'protein': 10,
                'carbs': 3.6,
                'fat': 0.4,
                'fiber': 0,
                'vitamins': 'B12, B2',
                'minerals': 'Calcium, Phosphorus',
                'suitable_for_conditions': 'Weight Management, Bone Health'
            },
            {
                'id': 7,
                'name': 'Almonds',
                'category': 'Nuts',
                'calories_per_100g': 579,
                'protein': 21,
                'carbs': 22,
                'fat': 50,
                'fiber': 12,
                'vitamins': 'E, B2',
                'minerals': 'Magnesium, Calcium',
                'suitable_for_conditions': 'Heart Health, Weight Management'
            },
            {
                'id': 8,
                'name': 'Spinach',
                'category': 'Vegetables',
                'calories_per_100g': 23,
                'protein': 2.9,
                'carbs': 3.6,
                'fat': 0.4,
                'fiber': 2.2,
                'vitamins': 'K, A, C, Folate',
                'minerals': 'Iron, Calcium, Magnesium',
                'suitable_for_conditions': 'Diabetes, Heart Health, Anemia'
            },
            {
                'id': 9,
                'name': 'Sweet Potato',
                'category': 'Vegetables',
                'calories_per_100g': 86,
                'protein': 1.6,
                'carbs': 20,
                'fat': 0.1,
                'fiber': 3,
                'vitamins': 'A, C, B6',
                'minerals': 'Potassium, Manganese',
                'suitable_for_conditions': 'Diabetes, Weight Management'
            },
            {
                'id': 10,
                'name': 'Oatmeal',
                'category': 'Grains',
                'calories_per_100g': 68,
                'protein': 2.4,
                'carbs': 12,
                'fat': 1.4,
                'fiber': 1.7,
                'vitamins': 'B1, B6',
                'minerals': 'Manganese, Magnesium',
                'suitable_for_conditions': 'Diabetes, Heart Health'
            }
        ]
        
        return pd.DataFrame(foods)
    
    def load_data_to_database(self):
        """Load all processed data into the database"""
        try:
            # Authenticate with Kaggle
            self.authenticate_kaggle()
            
            # Download datasets
            print("Downloading datasets...")
            df_drugs = self.download_drug_reviews_dataset()
            df_nutrition = self.download_nutrition_dataset()
            df_interactions = self.download_drug_interactions_dataset()
            
            # Process data
            print("Processing data...")
            processed_drugs = self.process_drug_data(df_drugs)
            processed_nutrition = self.process_nutrition_data(df_nutrition)
            
            # Load to database
            if processed_drugs is not None:
                processed_drugs.to_sql('drugs', self.engine, if_exists='replace', index=False)
                print(f"Loaded {len(processed_drugs)} drugs to database")
            
            if processed_nutrition is not None:
                processed_nutrition.to_sql('foods', self.engine, if_exists='replace', index=False)
                print(f"Loaded {len(processed_nutrition)} foods to database")
            
            if df_interactions is not None:
                df_interactions.to_sql('drug_interactions', self.engine, if_exists='replace', index=False)
                print(f"Loaded {len(df_interactions)} drug interactions to database")
            
            print("Data loading completed successfully!")
            
        except Exception as e:
            print(f"Error loading data to database: {e}")

if __name__ == "__main__":
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Initialize data loader
    loader = MedicalDataLoader()
    
    # Load all data
    loader.load_data_to_database()
