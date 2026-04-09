import math

def calculate_distance(p1, p2):
    """Euclidean distance safely between two points."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

def calculate_iou(box1, box2):
    """
    Calculate bounding box Intersection over Union (IoU)
    Boxes are in format: [x1, y1, x2, y2]
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0.0

    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    union_area = box1_area + box2_area - inter_area
    if union_area <= 0:
        return 0.0
        
    return inter_area / union_area
