import pymupdf
import os
import math

def draw_badge(page, pt, number, color=(0.88, 0.12, 0.12), radius=13):
    # Dark drop shadow for contrast
    page.draw_circle(pymupdf.Point(pt.x + 1.2, pt.y + 1.2), radius, color=(0, 0, 0), fill=(0.1, 0.1, 0.1), fill_opacity=0.35)
    # Circle with white border
    page.draw_circle(pt, radius, color=(1, 1, 1), fill=color, width=1.8)
    # White number text
    offset_x = 3.8 if len(str(number)) == 1 else 6.8
    page.insert_text(pymupdf.Point(pt.x - offset_x, pt.y + 4.5), str(number), fontsize=12, color=(1, 1, 1), fontname="helv", render_mode=0)

def draw_highlight(page, rect, color=(0.88, 0.12, 0.12), width=2, fill_opacity=0.06):
    page.draw_rect(rect, color=color, fill=color, fill_opacity=fill_opacity, width=width)

def draw_arrow(page, p1, p2, color=(0.88, 0.12, 0.12), width=2.2):
    page.draw_line(p1, p2, color=color, width=width)
    angle = math.atan2(p2.y - p1.y, p2.x - p1.x)
    arrow_len = 9
    a1 = angle + math.pi * 0.85
    a2 = angle - math.pi * 0.85
    hp1 = pymupdf.Point(p2.x + arrow_len * math.cos(a1), p2.y + arrow_len * math.sin(a1))
    hp2 = pymupdf.Point(p2.x + arrow_len * math.cos(a2), p2.y + arrow_len * math.sin(a2))
    page.draw_polyline([hp1, p2, hp2], color=color, fill=color, width=width)

def annotate_image(src_path, dest_path, annotations):
    pix = pymupdf.Pixmap(src_path)
    doc = pymupdf.open()
    page = doc.new_page(width=pix.width, height=pix.height)
    page.insert_image(pymupdf.Rect(0, 0, pix.width, pix.height), filename=src_path)

    # Highlights
    for h in annotations.get("highlights", []):
        draw_highlight(page, pymupdf.Rect(*h["rect"]), color=h.get("color", (0.88, 0.12, 0.12)), width=h.get("width", 2), fill_opacity=h.get("fill_opacity", 0.06))

    # Arrows
    for a in annotations.get("arrows", []):
        draw_arrow(page, pymupdf.Point(*a["p1"]), pymupdf.Point(*a["p2"]), color=a.get("color", (0.88, 0.12, 0.12)), width=a.get("width", 2.2))

    # Badges
    for b in annotations.get("badges", []):
        draw_badge(page, pymupdf.Point(*b["pt"]), b["num"], color=b.get("color", (0.88, 0.12, 0.12)), radius=b.get("radius", 13))

    pix_out = page.get_pixmap(dpi=120)
    pix_out.save(dest_path)
    doc.close()
    print(f"Saved: {dest_path} ({pix_out.width}x{pix_out.height})")

def run():
    base_dir = "docs/images/admin"
    evidence_dir = "C:/Users/Daniela Ann/.gemini/antigravity/brain/e2c6050c-cb10-466b-bd08-b2b504b88f1e/browser_evidence/0fc24f61-0cd9-4b83-b37b-1931e72d4f49"
    art_dir = "C:/Users/Daniela Ann/.gemini/antigravity/brain/e2c6050c-cb10-466b-bd08-b2b504b88f1e/admin_screenshots"
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(art_dir, exist_ok=True)

    # -------------------------------------------------------------
    # 1. Dashboard Overview (final_step_27.png: 1024x694)
    # -------------------------------------------------------------
    d_annot = {
        "highlights": [
            {"rect": (10, 50, 258, 649), "color": (0.05, 0.55, 0.35)},   # 1: Sidebar Rail
            {"rect": (286, 86, 985, 181), "color": (0.1, 0.45, 0.85)},   # 2: Telemetry Metrics
            {"rect": (286, 204, 625, 635), "color": (0.88, 0.12, 0.12)}, # 3: Recent Applications
            {"rect": (515, 215, 618, 245), "color": (0.88, 0.12, 0.12)}, # 4: View Applicants Action
            {"rect": (645, 204, 985, 635), "color": (0.45, 0.25, 0.75)}  # 5: Recent Activity Stream
        ],
        "arrows": [
            {"p1": (455, 181), "p2": (455, 204)},
            {"p1": (440, 230), "p2": (510, 230)}
        ],
        "badges": [
            {"pt": (244, 75), "num": 1, "color": (0.05, 0.55, 0.35)},
            {"pt": (304, 98), "num": 2, "color": (0.1, 0.45, 0.85)},
            {"pt": (304, 216), "num": 3, "color": (0.88, 0.12, 0.12)},
            {"pt": (605, 216), "num": 4, "color": (0.88, 0.12, 0.12)},
            {"pt": (663, 216), "num": 5, "color": (0.45, 0.25, 0.75)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_27.png", f"{base_dir}/dashboard-overview.png", d_annot)
    annotate_image(f"{evidence_dir}/final_step_27.png", f"{art_dir}/dashboard-overview.png", d_annot)

    # -------------------------------------------------------------
    # 2. Applicants Workspace (final_step_47.png: 1024x694)
    # -------------------------------------------------------------
    a_annot = {
        "highlights": [
            {"rect": (286, 84, 695, 120), "color": (0.05, 0.55, 0.35)},  # 1: Subtabs Bar
            {"rect": (286, 140, 985, 220), "color": (0.1, 0.45, 0.85)},  # 2: Metric Tiles
            {"rect": (286, 233, 985, 341), "color": (0.88, 0.12, 0.12)}, # 3: Multi-Parameter Filters
            {"rect": (286, 364, 985, 683), "color": (0.1, 0.45, 0.85)},  # 4: Applicants Table
            {"rect": (905, 412, 975, 442), "color": (0.88, 0.12, 0.12)}  # 5: First Row View Action
        ],
        "arrows": [
            {"p1": (635, 341), "p2": (635, 364)},
            {"p1": (810, 427), "p2": (900, 427)}
        ],
        "badges": [
            {"pt": (304, 94), "num": 1, "color": (0.05, 0.55, 0.35)},
            {"pt": (304, 152), "num": 2, "color": (0.1, 0.45, 0.85)},
            {"pt": (304, 245), "num": 3, "color": (0.88, 0.12, 0.12)},
            {"pt": (304, 376), "num": 4, "color": (0.1, 0.45, 0.85)},
            {"pt": (895, 427), "num": 5, "color": (0.88, 0.12, 0.12)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_47.png", f"{base_dir}/applicants-workspace.png", a_annot)
    annotate_image(f"{evidence_dir}/final_step_47.png", f"{art_dir}/applicants-workspace.png", a_annot)

    # -------------------------------------------------------------
    # 3. Document Reviews (final_step_65.png: 1024x694)
    # -------------------------------------------------------------
    r_annot = {
        "highlights": [
            {"rect": (108, 55, 650, 655), "color": (0.1, 0.45, 0.85)},   # 1: Document Preview Stage
            {"rect": (665, 60, 970, 240), "color": (0.45, 0.25, 0.75)},  # 2: File Metadata
            {"rect": (665, 250, 970, 595), "color": (0.05, 0.55, 0.35)}, # 3: Verification Checklist
            {"rect": (714, 615, 810, 652), "color": (0.88, 0.12, 0.12)}, # 4: Reject Document Action
            {"rect": (833, 615, 965, 652), "color": (0.05, 0.55, 0.35)}  # 5: Approve Document Action
        ],
        "arrows": [
            {"p1": (650, 350), "p2": (665, 350)},
            {"p1": (818, 595), "p2": (818, 613)}
        ],
        "badges": [
            {"pt": (126, 75), "num": 1, "color": (0.1, 0.45, 0.85)},
            {"pt": (683, 78), "num": 2, "color": (0.45, 0.25, 0.75)},
            {"pt": (683, 268), "num": 3, "color": (0.05, 0.55, 0.35)},
            {"pt": (722, 622), "num": 4, "color": (0.88, 0.12, 0.12)},
            {"pt": (841, 622), "num": 5, "color": (0.05, 0.55, 0.35)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_65.png", f"{base_dir}/document-reviews.png", r_annot)
    annotate_image(f"{evidence_dir}/final_step_65.png", f"{art_dir}/document-reviews.png", r_annot)

    # -------------------------------------------------------------
    # 4. Billing Management (final_step_53.png: 1024x694)
    # -------------------------------------------------------------
    b_annot = {
        "highlights": [
            {"rect": (286, 84, 585, 120), "color": (0.05, 0.55, 0.35)},  # 1: Subtabs Bar
            {"rect": (286, 252, 605, 620), "color": (0.1, 0.45, 0.85)},  # 2: Left Source Pool
            {"rect": (612, 395, 660, 530), "color": (0.88, 0.12, 0.12)}, # 3: Transfer Arrow Controls
            {"rect": (668, 252, 985, 620), "color": (0.05, 0.55, 0.35)}, # 4: Right Staged Queue
            {"rect": (765, 630, 980, 668), "color": (0.88, 0.12, 0.12)}  # 5: Generate Certification Action
        ],
        "arrows": [
            {"p1": (605, 462), "p2": (612, 462)},
            {"p1": (660, 462), "p2": (668, 462)},
            {"p1": (872, 620), "p2": (872, 628)}
        ],
        "badges": [
            {"pt": (304, 94), "num": 1, "color": (0.05, 0.55, 0.35)},
            {"pt": (304, 264), "num": 2, "color": (0.1, 0.45, 0.85)},
            {"pt": (636, 385), "num": 3, "color": (0.88, 0.12, 0.12)},
            {"pt": (686, 264), "num": 4, "color": (0.05, 0.55, 0.35)},
            {"pt": (773, 638), "num": 5, "color": (0.88, 0.12, 0.12)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_53.png", f"{base_dir}/billing-management.png", b_annot)
    annotate_image(f"{evidence_dir}/final_step_53.png", f"{art_dir}/billing-management.png", b_annot)

    # -------------------------------------------------------------
    # 5. Payroll Management (final_step_116.png: 1024x960)
    # Full unclipped view showing subtabs, filters, dual-list AND generate button!
    # -------------------------------------------------------------
    p_annot = {
        "highlights": [
            {"rect": (247, 70, 318, 100), "color": (0.05, 0.55, 0.35)},  # 1: Active Payroll Lists Tab
            {"rect": (621, 380, 725, 425), "color": (0.88, 0.12, 0.12)}, # 2: 'Not included yet' Filter Dropdown
            {"rect": (243, 606, 575, 935), "color": (0.1, 0.45, 0.85)},  # 3: Source Pool List of Scholars
            {"rect": (890, 895, 984, 934), "color": (0.88, 0.12, 0.12)}, # 4: Generate Payroll List Action Button
            {"rect": (402, 70, 495, 100), "color": (0.45, 0.25, 0.75)}   # 5: Payout Schedules Tab
        ],
        "arrows": [
            {"p1": (673, 355), "p2": (673, 378)},  # Points to 'Not included yet' filter dropdown
            {"p1": (575, 770), "p2": (620, 770)},  # Points from List of Scholars to For Payroll
            {"p1": (320, 85), "p2": (400, 85)}     # Points from Payroll Lists to Payout Schedules
        ],
        "badges": [
            {"pt": (259, 75), "num": 1, "color": (0.05, 0.55, 0.35)},
            {"pt": (633, 386), "num": 2, "color": (0.88, 0.12, 0.12)},
            {"pt": (260, 620), "num": 3, "color": (0.1, 0.45, 0.85)},
            {"pt": (898, 902), "num": 4, "color": (0.88, 0.12, 0.12)},
            {"pt": (414, 75), "num": 5, "color": (0.45, 0.25, 0.75)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_116.png", f"{base_dir}/payroll-management.png", p_annot)
    annotate_image(f"{evidence_dir}/final_step_116.png", f"{art_dir}/payroll-management.png", p_annot)

    # -------------------------------------------------------------
    # 6. System Settings (final_step_33.png: 1024x694)
    # -------------------------------------------------------------
    s_annot = {
        "highlights": [
            {"rect": (286, 84, 850, 120), "color": (0.05, 0.55, 0.35)},  # 1: Settings Navigation Subtabs
            {"rect": (286, 145, 560, 220), "color": (0.88, 0.12, 0.12)}, # 2: Availability Radio Toggle
            {"rect": (286, 230, 790, 320), "color": (0.1, 0.45, 0.85)},  # 3: PST Schedule Window Pickers
            {"rect": (286, 345, 480, 380), "color": (0.88, 0.12, 0.12)}, # 4: Save Application Setting Action
            {"rect": (610, 84, 735, 120), "color": (0.45, 0.25, 0.75)}   # 5: School Catalog Tab
        ],
        "arrows": [
            {"p1": (538, 320), "p2": (480, 345)},
            {"p1": (550, 102), "p2": (605, 102)}
        ],
        "badges": [
            {"pt": (304, 94), "num": 1, "color": (0.05, 0.55, 0.35)},
            {"pt": (304, 155), "num": 2, "color": (0.88, 0.12, 0.12)},
            {"pt": (304, 240), "num": 3, "color": (0.1, 0.45, 0.85)},
            {"pt": (304, 350), "num": 4, "color": (0.88, 0.12, 0.12)},
            {"pt": (622, 94), "num": 5, "color": (0.45, 0.25, 0.75)}
        ]
    }
    annotate_image(f"{evidence_dir}/final_step_33.png", f"{base_dir}/settings-workspace.png", s_annot)
    annotate_image(f"{evidence_dir}/final_step_33.png", f"{art_dir}/settings-workspace.png", s_annot)

if __name__ == "__main__":
    run()
