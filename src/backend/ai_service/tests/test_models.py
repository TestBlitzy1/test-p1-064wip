"""
Comprehensive test suite for AI service model classes including campaign generator,
content generator, keyword recommender, and performance predictor models.
"""

import pytest
import torch
import numpy as np
from datetime import datetime
from uuid import uuid4

from ..models.campaign_generator import CampaignGenerator
from ..models.content_generator import ContentGenerator
from ..models.keyword_recommender import KeywordRecommender
from ..models.performance_predictor import PerformancePredictor

# Test device configuration
TEST_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Test campaign context
TEST_CAMPAIGN_CONTEXT = {
    "objective": "brand_awareness",
    "industry": "technology",
    "target_audience": {
        "job_titles": ["CTO", "IT Director"],
        "company_size": "50-1000"
    },
    "budget": 5000.0
}

class TestCampaignGenerator:
    """Test suite for campaign structure generation model."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test environment for campaign generator."""
        self.model = CampaignGenerator(
            model_path="models/campaign_generator/v1",
            device=TEST_DEVICE,
            platform_configs={
                'linkedin': {
                    'ad_formats': ['single_image', 'carousel', 'video'],
                    'targeting_options': ['job_title', 'company_size', 'industry'],
                    'min_budget_per_ad': 10.0
                },
                'google': {
                    'ad_formats': ['responsive_search', 'display', 'discovery'],
                    'targeting_options': ['keywords', 'audiences', 'placements'],
                    'min_budget_per_ad': 5.0
                }
            }
        )
        yield
        # Cleanup
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @pytest.mark.asyncio
    async def test_campaign_structure_generation(self):
        """Test campaign structure generation functionality and performance."""
        # Start performance timer
        start_time = datetime.now()

        # Generate campaign structure
        campaign_structure = await self.model.generate_campaign_structure(
            campaign_objective="brand_awareness",
            platform="linkedin",
            target_audience=TEST_CAMPAIGN_CONTEXT["target_audience"],
            budget=TEST_CAMPAIGN_CONTEXT["budget"],
            format_preferences={"preferred_formats": ["single_image", "carousel"]}
        )

        # Validate generation time
        generation_time = (datetime.now() - start_time).total_seconds()
        assert generation_time < 30, "Campaign generation exceeded 30-second limit"

        # Validate structure completeness
        assert "campaign_objective" in campaign_structure
        assert "platform" in campaign_structure
        assert "budget" in campaign_structure
        assert "ad_groups" in campaign_structure
        assert len(campaign_structure["ad_groups"]) > 0

        # Validate LinkedIn platform compliance
        assert campaign_structure["platform"] == "linkedin"
        assert campaign_structure["budget"] >= 10.0
        assert all(
            ad_format in ["single_image", "carousel", "video"]
            for group in campaign_structure["ad_groups"]
            for ad in group.get("ads", [])
        )

        # Validate targeting parameters
        targeting = campaign_structure.get("targeting_settings", {})
        assert "job_titles" in targeting
        assert "company_size" in targeting
        assert "industry" in targeting

        # Validate budget allocation
        total_budget = sum(
            group["budget"]
            for group in campaign_structure["ad_groups"]
        )
        assert abs(total_budget - TEST_CAMPAIGN_CONTEXT["budget"]) < 0.01

        # Check memory cleanup
        if torch.cuda.is_available():
            assert torch.cuda.memory_allocated() < torch.cuda.max_memory_allocated()

    @pytest.mark.asyncio
    async def test_structure_validation(self):
        """Test campaign structure validation logic."""
        # Test valid structure
        valid_structure = {
            "campaign_objective": "brand_awareness",
            "platform": "linkedin",
            "budget": 5000.0,
            "targeting_settings": {
                "job_titles": ["CTO", "IT Director"],
                "company_size": "50-1000",
                "industry": "technology"
            },
            "ad_groups": [
                {
                    "name": "Test Group 1",
                    "budget": 2500.0,
                    "targeting_criteria": {"job_titles": ["CTO"]},
                    "ads": [
                        {
                            "format": "single_image",
                            "creative": {"image_url": "test.jpg"}
                        }
                    ]
                }
            ]
        }
        is_valid, error_msg, details = self.model.validate_structure(
            valid_structure,
            "linkedin",
            strict_mode=True
        )
        assert is_valid
        assert not error_msg
        assert details["budget_validated"]
        assert details["formats_validated"]
        assert details["targeting_validated"]

        # Test invalid structure (missing required targeting)
        invalid_structure = valid_structure.copy()
        invalid_structure["targeting_settings"].pop("industry")
        is_valid, error_msg, details = self.model.validate_structure(
            invalid_structure,
            "linkedin",
            strict_mode=True
        )
        assert not is_valid
        assert "targeting options" in error_msg.lower()

        # Test invalid budget allocation
        invalid_budget = valid_structure.copy()
        invalid_budget["budget"] = 5.0
        is_valid, error_msg, details = self.model.validate_structure(
            invalid_budget,
            "linkedin",
            strict_mode=True
        )
        assert not is_valid
        assert "budget" in error_msg.lower()

        # Test invalid ad format
        invalid_format = valid_structure.copy()
        invalid_format["ad_groups"][0]["ads"][0]["format"] = "invalid_format"
        is_valid, error_msg, details = self.model.validate_structure(
            invalid_format,
            "linkedin",
            strict_mode=True
        )
        assert not is_valid
        assert "format" in error_msg.lower()

class TestContentGenerator:
    """Test suite for ad copy generation model."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test environment for content generator."""
        self.model = ContentGenerator(
            model_path="models/content_generator/v1",
            device=TEST_DEVICE
        )
        yield
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @pytest.mark.asyncio
    async def test_ad_copy_generation(self):
        """Test ad copy generation functionality."""
        # Generate ad copies
        ad_copies = await self.model.generate_ad_copies(
            platform="linkedin",
            campaign_context=TEST_CAMPAIGN_CONTEXT,
            num_variations=5
        )

        # Validate number of variations
        assert len(ad_copies) >= 5, "Insufficient number of ad copy variations"

        # Validate copy structure
        for copy in ad_copies:
            assert "content" in copy
            assert "metadata" in copy
            assert "scores" in copy
            assert copy["scores"]["brand_consistency"] >= 0.8

        # Validate platform compliance
        for copy in ad_copies:
            is_valid, _, _ = self.model.validate_copy(
                copy["content"],
                "linkedin",
                TEST_CAMPAIGN_CONTEXT
            )
            assert is_valid

        # Test generation time
        start_time = datetime.now()
        await self.model.generate_ad_copies(
            platform="linkedin",
            campaign_context=TEST_CAMPAIGN_CONTEXT,
            num_variations=3
        )
        generation_time = (datetime.now() - start_time).total_seconds()
        assert generation_time < 30, "Ad copy generation exceeded 30-second limit"

class TestKeywordRecommender:
    """Test suite for keyword recommendation model."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test environment for keyword recommender."""
        self.model = KeywordRecommender(
            model_path="models/keyword_recommender/v1",
            model_config={"version": "1.0.0"},
            device=TEST_DEVICE
        )
        yield
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @pytest.mark.asyncio
    async def test_keyword_generation(self):
        """Test keyword generation and optimization."""
        # Generate keywords
        keywords = await self.model.generate_keywords(
            TEST_CAMPAIGN_CONTEXT,
            platform="google"
        )

        # Validate keyword structure
        assert len(keywords) > 0
        for keyword in keywords:
            assert "keyword" in keyword
            assert "relevance_score" in keyword
            assert "performance_score" in keyword
            assert "final_score" in keyword
            assert keyword["final_score"] >= 0.6

        # Validate keyword optimization
        optimized = self.model.optimize_keywords(
            keywords,
            performance_data={"ctr": {}, "conversion_rate": {}, "cost_per_click": {}}
        )
        assert len(optimized) > 0
        assert all(k["final_score"] >= 0.6 for k in optimized)

class TestPerformancePredictor:
    """Test suite for performance prediction model."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test environment for performance predictor."""
        self.model = PerformancePredictor(
            platform="linkedin",
            model_config={
                "input_dim": 64,
                "output_dim": 4,
                "weights_path": "models/performance_predictor/v1/weights.pt"
            }
        )
        yield
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @pytest.mark.asyncio
    async def test_performance_prediction(self):
        """Test performance metric prediction functionality."""
        # Generate predictions
        predictions = self.model.predict_metrics(TEST_CAMPAIGN_CONTEXT)

        # Validate prediction structure
        assert "ctr" in predictions
        assert "conversion_rate" in predictions
        assert "cpc" in predictions
        assert "roas" in predictions
        assert "confidence_scores" in predictions

        # Validate prediction ranges
        assert 0 <= predictions["ctr"] <= 100
        assert 0 <= predictions["conversion_rate"] <= 100
        assert predictions["cpc"] >= 0
        assert predictions["roas"] >= 0

        # Validate confidence scores
        for metric, score in predictions["confidence_scores"].items():
            assert 0 <= score <= 1

        # Test historical analysis
        campaign_id = uuid4()
        analysis = self.model.analyze_historical_performance(
            campaign_id,
            analysis_config={"time_period": "30d"}
        )
        assert "trends" in analysis
        assert "campaign_id" in analysis
        assert "platform" in analysis