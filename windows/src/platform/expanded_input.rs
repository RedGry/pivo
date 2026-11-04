use crate::app::geometry;
use windows_sys::Win32::{
    Foundation::{HWND, POINT},
    Graphics::Gdi::*,
};

/// Match the terminal Expanded clip path in frontend/src/presentation/island.ts.
unsafe fn region(width: i32, dpi: u32, scale: f64) -> HRGN {
    let (width, height) = (f64::from(width), f64::from(geometry::HEIGHT));
    let (shoulder, depth, radius) = (20.0, 30.0, 30.0);
    let right = width - shoulder;
    let bottom = height - radius;
    let corner = radius * 0.55228475;
    let factor = f64::from(dpi) / 96.0 * scale;
    let points = [
        (0.0, 0.0),
        (shoulder * 0.6, 0.0),
        (shoulder, depth * 0.4),
        (shoulder, depth),
        (shoulder, bottom),
        (shoulder, bottom + corner),
        (shoulder + radius - corner, height),
        (shoulder + radius, height),
        (right - radius, height),
        (right - radius + corner, height),
        (right, bottom + corner),
        (right, bottom),
        (right, depth),
        (right, depth * 0.4),
        (width - shoulder * 0.6, 0.0),
        (width, 0.0),
    ]
    .map(|(x, y)| POINT {
        x: (x * factor).round() as i32,
        y: (y * factor).round() as i32,
    });
    let [m, c, l, z] = [PT_MOVETO, PT_BEZIERTO, PT_LINETO, PT_CLOSEFIGURE].map(|v| v as u8);
    let types = [m, c, c, c, l, c, c, c, l, c, c, c, l, c, c, c | z];
    unsafe {
        let dc = CreateCompatibleDC(std::ptr::null_mut());
        if dc.is_null() {
            return std::ptr::null_mut();
        }
        let region = if BeginPath(dc) != 0
            && PolyDraw(dc, points.as_ptr(), types.as_ptr(), points.len() as i32) != 0
            && EndPath(dc) != 0
        {
            PathToRegion(dc)
        } else {
            std::ptr::null_mut()
        };
        DeleteDC(dc);
        region
    }
}

pub fn clip(window: HWND, width: i32, dpi: u32, scale: f64) -> bool {
    unsafe {
        let region = region(width, dpi, scale);
        if region.is_null() {
            return false;
        }
        // A successful call transfers ownership of the region to the window.
        if SetWindowRgn(window, region, 0) == 0 {
            DeleteObject(region);
            return false;
        }
        true
    }
}

#[cfg(test)]
#[test]
fn expanded_input_region_excludes_transparent_shoulders_and_corners() {
    unsafe {
        for (width, dpi, scale) in [
            (geometry::WIDTH, 96, 1.0),
            (geometry::LYRICS_WIDTH, 120, 7.0 / 6.0),
        ] {
            let rgn = region(width, dpi, scale);
            assert!(!rgn.is_null());
            let contains = |x, y| {
                PtInRegion(
                    rgn,
                    geometry::physical(x, dpi, scale),
                    geometry::physical(y, dpi, scale),
                ) != 0
            };
            assert!(contains(200, 70));
            assert!(contains(width - 40, 70));
            assert!(contains(6, 1));
            assert!(!contains(2, 70));
            assert!(!contains(25, geometry::HEIGHT - 4));
            assert!(!contains(width - 25, geometry::HEIGHT - 4));
            DeleteObject(rgn);
        }
    }
}
