PREPROCESSOR_CATALOG = [
    {
        "category": "Line Extractors",
        "items": [
            {"node_type": "CannyEdgePreprocessor", "display_name": "Canny"},
            {"node_type": "HEDPreprocessor", "display_name": "HED"},
            {"node_type": "LineArtPreprocessor", "display_name": "LineArt"},
            {"node_type": "PiDiNetPreprocessor", "display_name": "PiDiNet"},
            {"node_type": "ScribblePreprocessor", "display_name": "Scribble"},
            {"node_type": "FakeScribblePreprocessor", "display_name": "Fake Scribble"},
            {"node_type": "M-LSDPreprocessor", "display_name": "M-LSD"},
            {"node_type": "BinaryPreprocessor", "display_name": "Binary"},
        ],
    },
    {
        "category": "Normal and Depth Estimators",
        "items": [
            {"node_type": "MiDaS-DepthMapPreprocessor", "display_name": "MiDaS Depth"},
            {"node_type": "Zoe-DepthMapPreprocessor", "display_name": "Zoe Depth"},
            {"node_type": "LeReS-DepthMapPreprocessor", "display_name": "LeReS Depth"},
            {"node_type": "BAE-NormalMapPreprocessor", "display_name": "BAE Normal"},
            {"node_type": "MiDaS-NormalMapPreprocessor", "display_name": "MiDaS Normal"},
        ],
    },
    {
        "category": "Faces and Poses Estimators",
        "items": [
            {"node_type": "OpenposePreprocessor", "display_name": "OpenPose"},
            {"node_type": "DWPreprocessor", "display_name": "DWPose"},
        ],
    },
    {
        "category": "Semantic Segmentation",
        "items": [
            {"node_type": "UniFormer-SemSegPreprocessor", "display_name": "UniFormer SemSeg"},
            {"node_type": "OneFormer-COCO-SemSegPreprocessor", "display_name": "OneFormer COCO SemSeg"},
            {"node_type": "OneFormer-ADE20K-SemSegPreprocessor", "display_name": "OneFormer ADE20K SemSeg"},
        ],
    },
    {
        "category": "T2IAdapter-only",
        "items": [
            {"node_type": "ColorPreprocessor", "display_name": "Color"},
        ],
    },
    {
        "category": "Others",
        "items": [
            {"node_type": "TilePreprocessor", "display_name": "Tile"},
            {"node_type": "SAMPreprocessor", "display_name": "SAM"},
        ],
    },
]
